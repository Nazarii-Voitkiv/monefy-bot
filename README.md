# monefy-bot — Docker setup

Quick setup to run the bot and Postgres in Docker (dev-friendly).

1. Copy env example and fill secrets:

```bash
cp .env.example .env
# edit .env and set BOT_TOKEN and POSTGRES_PASSWORD
```

2. Start with Docker Compose:

```bash
docker compose up --build
```

This will:
- start a Postgres 15 container (service name `db`)
- mount `./sql` into the DB init folder (place migrations there if needed)
- build the Node app image and run it in dev mode (nodemon) so code changes reflect immediately

Notes:
- The app waits for the DB to become healthy before applying a small migration (creates `expenses` table).
- For production, don't use `nodemon` in Docker; adapt the Dockerfile to run `npm ci --production` and `node` directly.
- Remove any real secrets from the repo; keep them in `.env` which is ignored by git.
