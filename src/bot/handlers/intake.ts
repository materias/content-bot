import type { Telegraf, Context } from 'telegraf';
import { downloadTelegramFile } from '../../media/telegramFile.js';
import { extractRepresentativeFrame } from '../../media/video.js';
import { blurScore, isTooBlurry } from '../../media/quality.js';
import { dHash, isNearDuplicate } from '../../media/phash.js';
import { analyzeImage } from '../../ai/claude.js';
import {
  createSubmission,
  getRecentPhashes,
  setBlurScore,
  setCaptionResult,
  setDraftMessageId,
  setPhash,
  transitionState,
} from '../../db/submissions.js';
import { renderDraftMessage } from './approval.js';

const VIDEO_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const MEDIA_GROUP_DEBOUNCE_MS = 800;

interface RawItem {
  mediaType: 'photo' | 'video';
  fileId: string;
  fileUniqueId: string;
  caption: string;
  fileSize?: number;
}

const pendingGroups = new Map<string, { items: RawItem[]; timer: NodeJS.Timeout }>();

export function registerIntakeHandlers(bot: Telegraf): void {
  bot.on('photo', (ctx) => handleIncoming(bot, ctx));
  bot.on('video', (ctx) => handleIncoming(bot, ctx));
}

function handleIncoming(bot: Telegraf, ctx: Context): void {
  const message = ctx.message;
  if (!message) return;

  let item: RawItem | undefined;
  if ('photo' in message && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    if (!largest) return;
    item = {
      mediaType: 'photo',
      fileId: largest.file_id,
      fileUniqueId: largest.file_unique_id,
      caption: message.caption ?? '',
    };
  } else if ('video' in message) {
    item = {
      mediaType: 'video',
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      caption: message.caption ?? '',
      fileSize: message.video.file_size,
    };
  }
  if (!item) return;

  if (item.mediaType === 'video' && (item.fileSize ?? 0) > VIDEO_DOWNLOAD_LIMIT_BYTES) {
    void ctx.reply(
      '⚠️ Это видео больше 20 МБ — Telegram Bot API не позволяет мне его скачать. Пришли, пожалуйста, версию поменьше или фото/кадр из видео.',
    );
    return;
  }

  const groupId = 'media_group_id' in message ? message.media_group_id : undefined;
  if (!groupId) {
    void processBatch(bot, ctx, [item]);
    return;
  }

  const existing = pendingGroups.get(groupId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.items.push(item);
    existing.timer = setTimeout(() => {
      pendingGroups.delete(groupId);
      void processBatch(bot, ctx, existing.items);
    }, MEDIA_GROUP_DEBOUNCE_MS);
  } else {
    const timer = setTimeout(() => {
      const group = pendingGroups.get(groupId);
      pendingGroups.delete(groupId);
      void processBatch(bot, ctx, group?.items ?? [item]);
    }, MEDIA_GROUP_DEBOUNCE_MS);
    pendingGroups.set(groupId, { items: [item], timer });
  }
}

async function processBatch(bot: Telegraf, ctx: Context, items: RawItem[]): Promise<void> {
  const bakerNote = items.map((i) => i.caption).find((c) => c.trim().length > 0) ?? '';

  const analyzed = await Promise.all(
    items.map(async (item) => {
      const rawBuffer = await downloadTelegramFile(bot, item.fileId);
      const stillBuffer =
        item.mediaType === 'video' ? await extractRepresentativeFrame(rawBuffer) : rawBuffer;
      const [blur, hash] = await Promise.all([blurScore(stillBuffer), dHash(stillBuffer)]);
      return { item, stillBuffer, blur, hash };
    }),
  );

  const survivors: typeof analyzed = [];
  let blurRejected = 0;
  let duplicateRejected = 0;

  for (const candidate of analyzed) {
    if (isTooBlurry(candidate.blur)) {
      blurRejected++;
      continue;
    }
    const dupInBatch = survivors.find((s) => isNearDuplicate(s.hash, candidate.hash));
    if (dupInBatch) {
      if (candidate.blur > dupInBatch.blur) {
        survivors.splice(survivors.indexOf(dupInBatch), 1, candidate);
      }
      duplicateRejected++;
      continue;
    }
    survivors.push(candidate);
  }

  if (blurRejected > 0 || duplicateRejected > 0) {
    const parts: string[] = [];
    if (blurRejected > 0) parts.push(`${blurRejected} размытых`);
    if (duplicateRejected > 0) parts.push(`${duplicateRejected} похожих друг на друга`);
    await ctx.reply(`Из присланного пропустила ${parts.join(' и ')} — не годятся для канала.`);
  }

  if (survivors.length === 0) return;

  const recentHistory = getRecentPhashes();

  for (const candidate of survivors) {
    const submission = createSubmission({
      media_type: candidate.item.mediaType,
      file_id: candidate.item.fileId,
      file_unique_id: candidate.item.fileUniqueId,
      baker_note: bakerNote,
    });
    setBlurScore(submission.id, candidate.blur);
    setPhash(submission.id, candidate.hash);

    const similarToOlder = recentHistory.some((h) => isNearDuplicate(h.phash, candidate.hash));

    transitionState(submission.id, 'analyzing');
    try {
      const result = await analyzeImage({
        imageBase64: candidate.stillBuffer.toString('base64'),
        mediaType: 'image/jpeg',
        bakerNote,
      });
      setCaptionResult(submission.id, result);
      const updated = transitionState(submission.id, 'awaiting_approval');
      const sent = await renderDraftMessage(bot, updated, similarToOlder);
      setDraftMessageId(submission.id, sent.message_id);
    } catch (err) {
      transitionState(submission.id, 'failed_analysis');
      await ctx.reply(
        `⚠️ Не смогла обработать один из кадров (заявка #${submission.id}). Попробуй прислать его ещё раз.`,
      );
      console.error('analyzeImage failed', err);
    }
  }
}
