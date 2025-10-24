import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
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
  DEFAULT_BASE_CURRENCY: z.enum(['USD', 'PLN', 'UAH']).default('USD')
});

export const env = envSchema.parse({
  BOT_TOKEN: process.env.BOT_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
  FX_API_URL: process.env.FX_API_URL,
  FX_API_KEY: process.env.FX_API_KEY,
  ALLOWED_USER_IDS: process.env.ALLOWED_USER_IDS,
  NODE_ENV: process.env.NODE_ENV,
  DEFAULT_BASE_CURRENCY: process.env.DEFAULT_BASE_CURRENCY
});

export const isDev = env.NODE_ENV === 'development';

export const allowedUserIds = env.ALLOWED_USER_IDS;
