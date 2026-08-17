import type { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { getOldestApproved, setChannelMessageId, transitionState } from '../db/submissions.js';

export async function publishNextApproved(bot: Telegraf): Promise<void> {
  const submission = getOldestApproved();
  if (!submission) return;

  try {
    const sent =
      submission.media_type === 'video'
        ? await bot.telegram.sendVideo(config.CHANNEL_ID, submission.file_id, {
            caption: submission.caption ?? '',
          })
        : await bot.telegram.sendPhoto(config.CHANNEL_ID, submission.file_id, {
            caption: submission.caption ?? '',
          });

    setChannelMessageId(submission.id, sent.message_id);
    transitionState(submission.id, 'posted');
  } catch (err) {
    transitionState(submission.id, 'failed_publish');
    console.error(`Failed to publish submission ${submission.id}`, err);
    await bot.telegram.sendMessage(
      config.BAKER_CHAT_ID,
      `⚠️ Не смогла опубликовать пост (заявка #${submission.id}). Попробую в следующий раз по расписанию — если повторится, скажи мне.`,
    );
  }
}
