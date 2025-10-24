CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id TEXT UNIQUE NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'uk-UA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE category_kind_enum AS ENUM ('income', 'expense');
CREATE TYPE currency_enum AS ENUM ('USD', 'PLN', 'UAH');

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind category_kind_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_user_name_kind_idx UNIQUE (tg_user_id, name, kind)
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id),
  sign SMALLINT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency currency_enum NOT NULL,
  amount_usd NUMERIC(14, 2) NOT NULL,
  note TEXT,
  txn_at TIMESTAMPTZ NOT NULL,
  rate_date DATE NOT NULL,
  is_rate_approx BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fx_rates (
  rate_date DATE PRIMARY KEY,
  base TEXT NOT NULL DEFAULT 'USD',
  pln NUMERIC(14, 6) NOT NULL,
  uah NUMERIC(14, 6) NOT NULL,
  usd NUMERIC(14, 6) NOT NULL DEFAULT 1,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
