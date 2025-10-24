import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import pg from 'pg';

const {
  BOT_TOKEN,
  DATABASE_URL: ENV_DATABASE_URL,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  POSTGRES_HOST,
  MODE = 'polling',
  PORT = 3000
} = process.env;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN missing'); process.exit(1);
}

// Construct DATABASE_URL from docker env vars when not provided
const DATABASE_URL = ENV_DATABASE_URL || (POSTGRES_HOST
  ? `postgresql://${POSTGRES_USER || 'postgres'}:${POSTGRES_PASSWORD || 'postgres'}@${POSTGRES_HOST}:${5432}/${POSTGRES_DB || 'postgres'}`
  : null);

const isSupabase = DATABASE_URL && DATABASE_URL.includes('.supabase.co');
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: isSupabase ? { rejectUnauthorized: false } : false
    })
  : null;

const bot = new Telegraf(BOT_TOKEN);

bot.start(ctx => ctx.reply('Привіт! Надішли: 120 UAH кава'));
bot.command('add', ctx => ctx.reply('Формат: 120 UAH кава'));

bot.on('text', async ctx => {
  const txt = (ctx.message.text || '').trim();
  const m = txt.match(/^(\d+(?:[.,]\d{1,2})?)\s*([A-Za-zА-Яа-я]{3})?\s*(.*)?$/);
  if (!m) return ctx.reply('Не зміг розпізнати. Приклад: 120 UAH кава');

  const amount = parseFloat(m[1].replace(',', '.'));
  const currency = (m[2] || 'UAH').toUpperCase();
  const note = (m[3] || '').trim();
  let savedToDb = false;

  if (pool) {
    try {
      await pool.query(
        `insert into expenses (user_telegram_id, amount, currency, note)
         values ($1,$2,$3,$4)`,
        [String(ctx.from.id), amount, currency, note]
      );
      savedToDb = true;
    } catch (err) {
      // log DB errors but don't crash the bot
      console.error('Failed to insert expense into DB:', err && err.message ? err.message : err);
    }
  }

  // If DB existed but we failed to save, inform user the record wasn't persisted.
  if (pool && !savedToDb) {
    return ctx.reply(
      `Прийняв: ${amount} ${currency}${note ? ` — ${note}` : ''} — але не зміг зберегти у базу. Спробуйте пізніше.`
    );
  }

  return ctx.reply(`Записав: ${amount} ${currency}${note ? ` — ${note}` : ''}`);
});

async function waitForDb(pool, attempts = 10, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      const wait = delayMs * Math.pow(2, i);
      console.log(`DB not ready yet (attempt ${i + 1}/${attempts}). Retrying in ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('DB did not become ready in time');
}

async function init() {
  if (pool) {
    try {
      await waitForDb(pool, 8, 500);
      // Ensure table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          user_telegram_id TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          currency TEXT NOT NULL,
          note TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('DB ready and migrations applied');
    } catch (err) {
      console.error('DB initialization failed:', err && err.message ? err.message : err);
      // If DB is not critical, continue without it. Otherwise uncomment to fail fast.
      // process.exit(1);
    }
  } else {
    console.warn('No DATABASE_URL — running without DB');
  }

  if (MODE === 'polling') {
    await bot.launch();
    console.log('Bot in polling mode');
  } else {
    const app = express();
    app.use(express.json());
    const path = `/webhook/${BOT_TOKEN}`;
    app.post(path, (req, res) => { bot.handleUpdate(req.body); res.sendStatus(200); });
    app.get('/', (_, res) => res.send('OK'));
    app.listen(PORT, () => console.log(`Webhook on :${PORT}${path}`));
  }

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

init();