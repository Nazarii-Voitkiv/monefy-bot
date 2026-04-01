import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  FX_API_URL: z
    .string()
    .url()
    .default('https://v6.exchangerate-api.com/v6'),
  FX_API_KEY: z.string().min(1, 'FX_API_KEY is required'),
  ALLOWED_USER_IDS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ?.split(',')
        .map((part) => part.trim())
        .filter(Boolean) ?? []
    ),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DEFAULT_BASE_CURRENCY: z.enum(['USD', 'PLN', 'UAH']).default('USD'),
  APP_BASE_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  DEV_TELEGRAM_USER_ID: z.string().optional()
});

export const env = envSchema.parse({
  BOT_TOKEN: process.env.BOT_TOKEN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  FX_API_URL: process.env.FX_API_URL,
  FX_API_KEY: process.env.FX_API_KEY,
  APP_BASE_URL: process.env.APP_BASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DEV_TELEGRAM_USER_ID: process.env.DEV_TELEGRAM_USER_ID,
  ALLOWED_USER_IDS: process.env.ALLOWED_USER_IDS,
  NODE_ENV: process.env.NODE_ENV,
  DEFAULT_BASE_CURRENCY: process.env.DEFAULT_BASE_CURRENCY
});

export const isDev = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const appBaseUrl = env.APP_BASE_URL?.replace(/\/$/, '');
export const sessionSecret = env.SESSION_SECRET ?? 'dev-session-secret';

export const allowedUserIds = env.ALLOWED_USER_IDS;

export function assertProductionEnv(): void {
  if (!isProduction) {
    return;
  }

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL must be provided in production');
  }

  if (!env.SESSION_SECRET?.trim()) {
    throw new Error('SESSION_SECRET must be provided in production');
  }

  if (allowedUserIds.length === 0) {
    throw new Error('ALLOWED_USER_IDS must contain at least one Telegram user ID in production');
  }
}
