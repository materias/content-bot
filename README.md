# content-bot

A private Telegram bot that turns "share a photo from your gallery" into a published channel post,
with a human approval step in between. Built for a home bakery whose owner didn't have time to sort
photos, write captions, or manage a posting schedule herself.

## How it works

1. She sends photos/videos (with an optional short note) to the bot in a private chat.
2. The bot drops blurry shots and near-duplicates locally — no API spend on unusable frames.
3. Surviving shots go to Claude (vision) with her note, which drafts a warm caption and flags any
   quality concerns.
4. The bot sends her the draft back with **✅ Опубликовать / ✏️ Исправить / ❌ Отклонить** buttons.
   Replying to a draft with new text replaces the caption in place.
5. Approved posts queue up; a scheduler publishes the oldest approved post at fixed times per day,
   straight to her channel — no manual posting.

Nothing goes live without her explicit approval. All AI calls run server-side against the
developer's own Anthropic API key — she never touches an AI account.

## Stack

TypeScript, [Telegraf](https://telegraf.js.org/) (long polling), the Anthropic SDK (`claude-opus-5`,
structured outputs via Zod), `sharp` for blur detection, a dHash + Hamming-distance perceptual hash
for near-duplicate detection, `better-sqlite3` for the only persisted state, `node-cron` for
scheduled publishing, Docker + docker-compose on a Hetzner VPS, deployed via GitHub Actions
(test → SSH + `docker compose up -d --build`).

## Development

```bash
npm install
cp .env.example .env   # fill in BOT_TOKEN, ANTHROPIC_API_KEY, BAKER_CHAT_ID, CHANNEL_ID
npm run dev             # long-polling bot with hot reload
npm run typecheck
npm test
```

## Prerequisites for a real deployment

1. **Bot token** — `/newbot` via [@BotFather](https://t.me/BotFather) → `BOT_TOKEN`.
2. **Baker's chat ID** — she sends `/start` to the bot, then
   `curl https://api.telegram.org/bot<TOKEN>/getUpdates` → `result[0].message.chat.id` → `BAKER_CHAT_ID`.
3. **Channel ID** — `@public_username` if the channel is public; otherwise add the bot as admin,
   post anything, and read `channel_post.chat.id` from `getUpdates`.
4. Add the bot as channel **Administrator** with "Post Messages" (and ideally "Edit Messages of Others").
5. An **Anthropic API key**.
6. A **Hetzner VPS** (or any small Linux box) with Docker + the compose plugin, SSH-key auth only,
   firewall open on port 22 only — long polling needs no inbound app port.
7. Decide **posting cadence + timezone** → `POST_TIMES` / `TZ` in `.env`.
8. GitHub Actions secrets for `.github/workflows/deploy.yml`: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
   App secrets (`BOT_TOKEN`, `ANTHROPIC_API_KEY`, ...) live only in the VPS's `.env`, never in CI.

## Deploying

```bash
# on the VPS, one-time:
git clone <repo> content-bot && cd content-bot
cp .env.example .env   # fill in real values
docker compose up -d --build
```

After that, every push to `main` that passes tests deploys automatically via SSH.
