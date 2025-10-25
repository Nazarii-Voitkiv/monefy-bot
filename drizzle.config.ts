import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env' });

// DATABASE_URL is optional in this repo when using Supabase JS SDK only.
// If you need to run drizzle-kit migrations locally, set DATABASE_URL to a
// Postgres connection string. When DATABASE_URL is not present, drizzle-kit
// commands may not work.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  },
  migrations: {
    table: 'drizzle_migrations'
  }
});
