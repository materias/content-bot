import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
  BAKER_CHAT_ID: z.coerce.number(),
  CHANNEL_ID: z.string().min(1),
  DB_PATH: z.string().default('/app/data/bot.db'),
  TZ: z.string().default('Europe/Moscow'),
  // Comma-separated 24h HH:mm times, baker-local (per TZ above), e.g. "10:00,17:00"
  POST_TIMES: z.string().default('10:00,17:00'),
});

export const config = schema.parse(process.env);

export const postTimes = config.POST_TIMES.split(',').map((t) => t.trim());
