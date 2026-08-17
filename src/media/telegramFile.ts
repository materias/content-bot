import type { Telegraf } from 'telegraf';

export async function downloadTelegramFile(bot: Telegraf, fileId: string): Promise<Buffer> {
  const link = await bot.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error(`Failed to download Telegram file ${fileId}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
