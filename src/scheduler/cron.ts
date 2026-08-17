import cron from 'node-cron';
import type { Telegraf } from 'telegraf';
import { config, postTimes } from '../config.js';
import { publishNextApproved } from './publish.js';

export function registerScheduledPublishing(bot: Telegraf): void {
  for (const time of postTimes) {
    const [hour, minute] = time.split(':');
    if (!hour || !minute) {
      throw new Error(`Invalid POST_TIMES entry: "${time}" (expected HH:mm)`);
    }
    const expression = `${minute} ${hour} * * *`;
    cron.schedule(expression, () => void publishNextApproved(bot), { timezone: config.TZ });
  }
}
