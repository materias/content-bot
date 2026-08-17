import './db/client.js';
import { createBot } from './bot/index.js';
import { registerScheduledPublishing } from './scheduler/cron.js';

const bot = createBot();
registerScheduledPublishing(bot);

bot.launch();
console.log('content-bot started (long polling)');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
