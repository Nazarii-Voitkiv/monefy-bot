import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { assertProductionEnv, sessionSecret } from '../../config/env';
import { BROWSER_CHALLENGE_COOKIE_NAME } from '../browser-auth';
import {
  BROWSER_SESSION_TTL_SECONDS,
  createSession,
  SESSION_TTL_SECONDS,
  type SessionPayload,
  verifySession
} from '../session';

export const SESSION_COOKIE_NAME = 'monefy_session';

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production'
  };
}

export function attachSessionCookie(
  response: NextResponse,
  payload: Omit<SessionPayload, 'exp'>,
  ttlSeconds = SESSION_TTL_SECONDS
): void {
  assertProductionEnv();

  const session = createSession(
    {
      ...payload,
      exp: payload.authAt + ttlSeconds
    },
    sessionSecret
  );

  response.cookies.set(SESSION_COOKIE_NAME, session, {
    ...buildCookieOptions(),
    maxAge: ttlSeconds
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...buildCookieOptions(),
    maxAge: 0
  });
}

export async function requireSession(): Promise<SessionPayload> {
  assertProductionEnv();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySession(token, sessionSecret);

  if (!payload) {
    throw new SessionError('Unauthorized', 401);
  }

  return payload;
}

export async function getSession(): Promise<SessionPayload | null> {
  assertProductionEnv();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token, sessionSecret);
}

export function buildBrowserSessionTtl(): number {
  return BROWSER_SESSION_TTL_SECONDS;
}

export function attachBrowserChallengeCookie(
  response: NextResponse,
  token: string,
  ttlSeconds: number
): void {
  response.cookies.set(BROWSER_CHALLENGE_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    maxAge: ttlSeconds
  });
}

export function clearBrowserChallengeCookie(response: NextResponse): void {
  response.cookies.set(BROWSER_CHALLENGE_COOKIE_NAME, '', {
    ...buildCookieOptions(),
    maxAge: 0
  });
}
