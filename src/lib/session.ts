import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const BROWSER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  authAt: number;
  exp: number;
  mode: 'browser' | 'development' | 'telegram';
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

export function createSession(payload: SessionPayload, secret: string): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now()
): SessionPayload | null {
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
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!payload.tgUserId || typeof payload.exp !== 'number') {
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
