import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { assertProductionEnv, sessionSecret } from '../../config/env';
import {
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
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production'
  };
}

export function attachSessionCookie(
  response: NextResponse,
  payload: Omit<SessionPayload, 'exp'>
): void {
  assertProductionEnv();

  const session = createSession(
    {
      ...payload,
      exp: payload.authAt + SESSION_TTL_SECONDS
    },
    sessionSecret
  );

  response.cookies.set(SESSION_COOKIE_NAME, session, buildCookieOptions());
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
