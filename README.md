# Monefy Dashboard

Private `Next.js` + Telegram Mini App for personal finance tracking. The bot remains the write interface, while the Mini App gives you a clean mobile dashboard for stats and history on Vercel.

## What is inside

- `Next.js 16` App Router app for the private frontend
- Telegram bot built with `Telegraf`
- Server-side Supabase access for transactions, categories, users, reports and FX rates
- Telegram `initData` validation and signed session cookies for frontend access
- Vercel-friendly Telegram webhook under `app/api/telegram/webhook`

## Access model

- The frontend is private and intended to open from Telegram only
- Access is granted only if the Telegram user id is present in `ALLOWED_USER_IDS`
- The frontend authenticates by validating `Telegram.WebApp.initData` on the server
- In local development you can use `DEV_TELEGRAM_USER_ID` to open the app in a regular browser

## Required environment variables

```bash
BOT_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
FX_API_KEY=
ALLOWED_USER_IDS=489177683
APP_BASE_URL=https://your-project.vercel.app
SESSION_SECRET=replace_with_a_long_random_secret
```

Optional:

```bash
FX_API_URL=https://v6.exchangerate-api.com/v6
DEFAULT_BASE_CURRENCY=USD
DEV_TELEGRAM_USER_ID=489177683
NODE_ENV=development
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
If you are not inside Telegram, set `DEV_TELEGRAM_USER_ID` to your Telegram user id.

## Checks

```bash
npm test
npm run lint
npm run build
```

## Deploy to Vercel

1. Create a Vercel project from this repo.
2. Add all required environment variables in Vercel.
3. Deploy.
4. Set the Telegram webhook:

```bash
npm run telegram:webhook:set
```

This points Telegram to:

```text
${APP_BASE_URL}/api/telegram/webhook
```

## Telegram app entry

- The bot menu button is configured to open the Mini App when `APP_BASE_URL` is set.
- `/start` also shows a direct “Відкрити дашборд” web app button.

## Project structure

- `app/` — Next.js app, frontend UI and route handlers
- `src/bot/` — Telegram bot commands and middleware
- `src/services/` — server-side business logic for data access and reporting
- `src/lib/` — auth/session helpers and dashboard aggregations
- `scripts/setTelegramWebhook.mjs` — helper for Telegram webhook setup
