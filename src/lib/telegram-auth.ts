import { createHmac, timingSafeEqual } from 'node:crypto';

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 60 * 15;

export interface TelegramUser {
  first_name?: string;
  id: number;
  language_code?: string;
  last_name?: string;
  username?: string;
}

export interface ValidatedTelegramInitData {
  authDate: number;
  hash: string;
  raw: string;
  user: TelegramUser;
}

function buildDataCheckString(params: URLSearchParams): string {
  return Array.from(params.entries())
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function createSecretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function buildTelegramHash(
  params: URLSearchParams,
  botToken: string
): string {
  return createHmac('sha256', createSecretKey(botToken))
    .update(buildDataCheckString(params))
    .digest('hex');
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  now = Date.now(),
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS
): ValidatedTelegramInitData {
  if (!initData.trim()) {
    throw new Error('Telegram initData is required');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Telegram initData hash is missing');
  }

  const expectedHash = buildTelegramHash(params, botToken);
  const providedBuffer = Buffer.from(hash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Telegram initData hash is invalid');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) {
    throw new Error('Telegram initData auth_date is invalid');
  }

  if (authDate * 1000 < now - maxAgeSeconds * 1000) {
    throw new Error('Telegram initData has expired');
  }

  const userJson = params.get('user');
  if (!userJson) {
    throw new Error('Telegram initData user payload is missing');
  }

  const user = JSON.parse(userJson) as TelegramUser;
  if (!user?.id) {
    throw new Error('Telegram initData user payload is invalid');
  }

  return {
    authDate,
    hash,
    raw: initData,
    user
  };
}
