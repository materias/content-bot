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
      [
        { text: '⚖️ Вес', callback_data: `weight:${id}` },
        { text: '💰 Цена', callback_data: `price:${id}` },
      ],
    ],
  };
}

type PendingField = 'weight' | 'price';

const FIELD_PROMPTS: Record<PendingField, string> = {
  weight: 'Какой вес? Ответь на это сообщение просто числом, например: 1,5 кг',
  price:
    'Напиши цену так, как хочешь её видеть в посте, целиком — единица бывает разная у разных ' +
    'товаров, например: "150 рублей за 1 шт", "1200 рублей за 1 кг", "Цена 170 руб — 1 шарик", ' +
    '"Стоимость данной коробки 1500 рублей".',
};

const FIELD_LINE: Record<PendingField, (value: string) => string> = {
  // Weight is always phrased the same way in her posts ("Вес торта 1,5 кг."), so a
  // fixed template is safe and saves typing.
  weight: (value) => `Вес торта ${value}.`,
  // Price phrasing genuinely varies by product (шт/кг/шарик/коробка, with/without a
  // per-unit split) — a fixed template would fight her own wording, so pass it through as-is.
  price: (value) => value,
};

// Keyed by the id of the bot's own prompt message ("Какой вес?..."), so a
// reply to that prompt is unambiguous — separate from replying to the draft
// itself, which means "replace the whole caption" (see the 'edit' flow).
const pendingFieldPrompts = new Map<number, { submissionId: number; field: PendingField }>();

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

    if (action === 'weight' || action === 'price') {
      if (submission.state !== 'awaiting_approval') {
        await ctx.answerCbQuery('Уже обработано');
        return;
      }
      await ctx.answerCbQuery();
      const prompt = await ctx.reply(FIELD_PROMPTS[action]);
      pendingFieldPrompts.set(prompt.message_id, { submissionId: id, field: action });
      return;
    }
  });

  bot.on('text', async (ctx, next) => {
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) return next();

    const pendingField = pendingFieldPrompts.get(replyTo.message_id);
    if (pendingField) {
      pendingFieldPrompts.delete(replyTo.message_id);
      const submission = getSubmission(pendingField.submissionId);
      if (!submission || submission.state !== 'awaiting_approval') return;

      const line = FIELD_LINE[pendingField.field](ctx.message.text.trim());
      const newCaption = [submission.caption ?? '', line].filter(Boolean).join('\n\n');
      setCaption(submission.id, newCaption);
      const updated = getSubmission(submission.id);
      if (!updated || !updated.draft_message_id) return;

      const caption = buildCaptionText(updated, false);
      await ctx.telegram.editMessageCaption(
        config.BAKER_CHAT_ID,
        updated.draft_message_id,
        undefined,
        caption,
        { reply_markup: buildKeyboard(submission.id) },
      );
      await ctx.reply('Добавила ✏️');
      return;
    }

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
