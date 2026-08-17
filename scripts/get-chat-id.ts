import { Telegraf } from 'telegraf';

const token = process.argv[2];
if (!token) {
  console.error('Usage: npm run get-chat-id -- <BOT_TOKEN>');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.on('message', (ctx) => {
  console.log(`chat.id = ${ctx.chat.id}  (from "${ctx.chat.type}" chat)`);
});

bot.on('channel_post', (ctx) => {
  console.log(`chat.id = ${ctx.chat.id}  (channel "${ctx.chat.title}")`);
});

bot.launch();
console.log(
  'Listening — send /start to the bot in a private chat, or post anything in a channel it admins. Ctrl+C to stop.',
);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
