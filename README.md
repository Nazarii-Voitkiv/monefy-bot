# Monefy Bot

Monefy Bot is a lightweight Telegram bot for personal finance tracking. It allows authorized users to record transactions, manage categories, view statistics and generate simple reports. The bot supports multi-currency operations and fetches exchange rates from an external provider.

## Key features

- Add income and expense transactions
- Categorize transactions and list categories
- View per-period statistics and transaction history
- Multi-currency support with external FX provider
- Minimal user authorization to restrict access
- Database-backed (Postgres via Drizzle ORM) with seed scripts
 - Minimal user authorization to restrict access
 - Database-backed (Postgres). Runtime access uses the Supabase client; Drizzle (drizzle-kit) is used for schema definition, migrations and code generation

## Architecture and components

- Telegram bot implemented using Telegraf
- TypeScript codebase
 - Database access at runtime via the Supabase JavaScript client (`@supabase/supabase-js`) and `pg` is used by Drizzle for migrations and local tooling
- External exchange rates provider integration
- Optional webhook entrypoint under `api/webhook.ts` for hosted deployments

Project layout (top-level)

- `src/bot/` — bot entrypoint, commands and middleware
- `src/services/` — domain services: transactions, users, reports, categories
- `src/config/env.ts` — environment variables and validation
- `drizzle/`, `sql/`, `scripts/` — migrations, initial SQL, and seed script
- `api/` — webhook handler for serverless hosting

## Tech stack

- Node.js 20.x
- TypeScript
- Telegraf (Telegram bot framework)
- Drizzle ORM and `pg` (Postgres client)
 - Supabase JavaScript client (`@supabase/supabase-js`) for runtime database operations
 - Drizzle ORM / `drizzle-kit` for schema definition, migrations and code generation
 - `pg` (Postgres client) used by tooling
- Zod for environment and data validation
- dotenv for local environment variable loading

## Requirements

- Node.js 20.x
- A Postgres database (if not using Supabase)
- Access to an exchange rates API (FX provider)

## Environment variables

The application uses the following environment variables (defined in `src/config/env.ts`):

- `BOT_TOKEN` (required) — Telegram bot token
- `FX_API_KEY` (required) — API key for the exchange rates provider
- `FX_API_URL` (optional) — Base URL for the FX API (default configured)
- `SUPABASE_URL` (optional) — Optional Supabase URL when using Supabase
- `SUPABASE_ANON_KEY` (optional) — Supabase anon/public key
- `ALLOWED_USER_IDS` (optional) — Comma-separated list of Telegram user IDs allowed to use the bot
- `NODE_ENV` (optional) — `development`, `test`, or `production` (defaults to `development`)
- `DEFAULT_BASE_CURRENCY` (optional) — Default currency for reports (one of `USD`, `PLN`, `UAH`)
- `WEBHOOK_DOMAIN` and `WEBHOOK_PATH` (optional) — When deploying via webhook, used to configure webhook URL

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root containing the required variables (at minimum `BOT_TOKEN` and `FX_API_KEY`).

3. Run the bot in development mode with automatic reload:

```bash
npm run dev
```

4. To run database migrations or generate Drizzle files, use:

```bash
npm run migrate
npm run generate
```

5. To seed the database (if needed):

```bash
npm run seed
```

## Production

1. Build the project:

```bash
npm run build
```

2. Start the production server:

```bash
npm run start
```

Alternatively, use the provided Docker compose commands:

```bash
npm run docker:up
npm run docker:down
```

## Contributing

Contributions are welcome. Please follow the repository guidelines and run lint/format checks before submitting code.

- Lint:

```bash
npm run lint
```

- Format check:

```bash
npm run format
```

## Notes

This README provides a quick overview and setup instructions. For specific implementation details, consult the source files under `src/` and the SQL in `drizzle/` and `sql/` directories.
