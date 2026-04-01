import { NextResponse } from 'next/server';

import {
  clearBrowserChallengeCookie,
  clearSessionCookie
} from '../../../../src/lib/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  clearBrowserChallengeCookie(response);
  return response;
}
