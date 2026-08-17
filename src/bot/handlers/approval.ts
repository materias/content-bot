import type { Telegraf, Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { config } from '../../config.js';
import {
  findByDraftMessageId,
  getSubmission,
  setCaption,
  transitionState,
  type Submission,
} from '../../db/submissions.js';

function buildCaptionText(submission: Submission, similarToOlder: boolean): string {
  const lines: string[] = [];
  if (submission.quality_flag === 'poor') {
    lines.push(`⚠️ Качество кадра сомнительное: ${submission.quality_reason}`, '');
  } else if (submission.quality_flag === 'marginal') {
    lines.push(`ℹ️ ${submission.quality_reason}`, '');
  }
  lines.push(submission.caption ?? '');
  if (similarToOlder) {
    lines.push('', '📸 Похоже на кадр из прошлых постов — если это нормально (например, допекла ещё), просто подтверди.');
  }
  return lines.join('\n');
}

function buildKeyboard(id: number) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Опубликовать', callback_data: `approve:${id}` },
        { text: '✏️ Исправить', callback_data: `edit:${id}` },
        { text: '❌ Отклонить', callback_data: `reject:${id}` },
      ],
    ],
  };
}

export async function renderDraftMessage(
  bot: Telegraf,
  submission: Submission,
  similarToOlder: boolean,
): Promise<Message> {
  const caption = buildCaptionText(submission, similarToOlder);
  const keyboard = buildKeyboard(submission.id);

  if (submission.media_type === 'video') {
    return bot.telegram.sendVideo(config.BAKER_CHAT_ID, submission.file_id, {
      caption,
      reply_markup: keyboard,
    });
  }
  return bot.telegram.sendPhoto(config.BAKER_CHAT_ID, submission.file_id, {
    caption,
    reply_markup: keyboard,
  });
}

export function registerApprovalHandlers(bot: Telegraf): void {
  bot.on('callback_query', async (ctx) => {
    const query = ctx.callbackQuery;
    if (!('data' in query) || !query.data) return;
    const [action, idStr] = query.data.split(':');
    const id = Number(idStr);
    if (!id || Number.isNaN(id)) return;

    const submission = getSubmission(id);
    if (!submission) {
      await ctx.answerCbQuery('Заявка не найдена');
      return;
    }

    if (action === 'approve') {
      if (submission.state !== 'awaiting_approval') {
        await ctx.answerCbQuery('Уже обработано');
        return;
      }
      transitionState(id, 'approved');
      await ctx.answerCbQuery('Добавлено в очередь публикации ✅');
      await ctx.editMessageReplyMarkup(undefined);
      return;
    }

    if (action === 'reject') {
      if (submission.state !== 'awaiting_approval') {
        await ctx.answerCbQuery('Уже обработано');
        return;
      }
      transitionState(id, 'rejected');
      await ctx.answerCbQuery('Отклонено');
      await ctx.editMessageReplyMarkup(undefined);
      return;
    }

    if (action === 'edit') {
      await ctx.answerCbQuery('Ответь на это сообщение новым текстом описания');
      return;
    }
  });

  bot.on('text', async (ctx, next) => {
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return next();

    const submission = findByDraftMessageId(replyTo.message_id);
    if (!submission || submission.state !== 'awaiting_approval') return next();

    setCaption(submission.id, ctx.message.text);
    const updated = getSubmission(submission.id);
    if (!updated) return;

    const caption = buildCaptionText(updated, false);
    await ctx.telegram.editMessageCaption(
      config.BAKER_CHAT_ID,
      replyTo.message_id,
      undefined,
      caption,
      { reply_markup: buildKeyboard(submission.id) },
    );
    await ctx.reply('Обновила текст ✏️');
  });
}
