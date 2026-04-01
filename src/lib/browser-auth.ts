import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import NodeCache from 'node-cache';

export const BROWSER_OTP_TTL_SECONDS = 60 * 30;
export const BROWSER_OTP_COOLDOWN_SECONDS = 60 * 30;
export const BROWSER_OTP_MAX_ATTEMPTS = 5;
export const BROWSER_CHALLENGE_COOKIE_NAME = 'monefy_browser_challenge';

const otpCooldownCache = new NodeCache({ stdTTL: BROWSER_OTP_COOLDOWN_SECONDS });

export interface BrowserChallengePayload {
  attempts: number;
  codeHash: string;
  exp: number;
  sentAt: number;
  tgUserId: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function hashBrowserOtpCode(code: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${code}`).digest('hex');
}

export function createBrowserChallenge(
  payload: BrowserChallengePayload,
  secret: string
): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyBrowserChallenge(
  token: string | undefined,
  secret: string,
  now = Date.now()
): BrowserChallengePayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as BrowserChallengePayload;
    if (!payload.tgUserId || !payload.codeHash) {
      return null;
    }

    if (payload.exp * 1000 <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function generateBrowserOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function getBrowserOtpThrottleRemaining(
  tgUserId: string,
  nowSeconds: number
): number {
  const sentAt = otpCooldownCache.get<number>(`browser-otp:${tgUserId}`);
  if (!sentAt) {
    return 0;
  }

  return Math.max(0, sentAt + BROWSER_OTP_COOLDOWN_SECONDS - nowSeconds);
}

export function touchBrowserOtpThrottle(
  tgUserId: string,
  nowSeconds: number
): void {
  otpCooldownCache.set(`browser-otp:${tgUserId}`, nowSeconds, BROWSER_OTP_COOLDOWN_SECONDS);
}
