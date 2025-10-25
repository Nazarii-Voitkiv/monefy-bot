-- SQL initialization for Supabase / PostgreSQL
-- Creates enums and tables matching src/db/schema.ts

-- Enums
DO $$BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_enum') THEN
  CREATE TYPE currency_enum AS ENUM ('USD','PLN','UAH');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_kind_enum') THEN
  CREATE TYPE category_kind_enum AS ENUM ('income','expense');
END IF;
END$$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id bigserial PRIMARY KEY,
  tg_user_id text NOT NULL UNIQUE,
  base_currency text NOT NULL DEFAULT 'USD',
  locale text NOT NULL DEFAULT 'uk-UA',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id bigserial PRIMARY KEY,
  tg_user_id text NOT NULL,
  name text NOT NULL,
  kind category_kind_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_kind_idx ON categories (tg_user_id, name, kind);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id bigserial PRIMARY KEY,
  tg_user_id text NOT NULL,
  category_id bigint NOT NULL REFERENCES categories(id),
  sign smallint NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency currency_enum NOT NULL,
  amount_usd numeric(14,2) NOT NULL,
  note text,
  txn_at timestamptz NOT NULL,
  rate_date date NOT NULL,
  is_rate_approx boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FX rates
CREATE TABLE IF NOT EXISTS fx_rates (
  rate_date date PRIMARY KEY,
  base text NOT NULL DEFAULT 'USD',
  pln numeric(14,6) NOT NULL,
  uah numeric(14,6) NOT NULL,
  usd numeric(14,6) NOT NULL DEFAULT '1',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
