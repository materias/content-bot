import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { registerIntakeHandlers } from './handlers/intake.js';
import { registerApprovalHandlers } from './handlers/approval.js';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.BOT_TOKEN);

  // This bot is a private tool for one person; ignore anyone else outright.
  bot.use((ctx, next) => {
    if (ctx.chat?.id !== config.BAKER_CHAT_ID) return;
    return next();
  });

  bot.start((ctx) => ctx.reply('Привет! Присылай сюда фото или видео выпечки — я подготовлю пост для канала 🧁'));

  registerIntakeHandlers(bot);
  registerApprovalHandlers(bot);

  bot.catch((err, ctx) => {
    console.error(`Unhandled error for update ${ctx.update.update_id}:`, err);
  });

  return bot;
}
