import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { assertProductionEnv, sessionSecret } from '../../../../../src/config/env';
import {
  BROWSER_OTP_MAX_ATTEMPTS,
  createBrowserChallenge,
  hashBrowserOtpCode,
  verifyBrowserChallenge
} from '../../../../../src/lib/browser-auth';
import {
  attachBrowserChallengeCookie,
  attachSessionCookie,
  buildBrowserSessionTtl,
  clearBrowserChallengeCookie
} from '../../../../../src/lib/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    assertProductionEnv();

    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim() ?? '';
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const challenge = verifyBrowserChallenge(
      cookieStore.get('monefy_browser_challenge')?.value,
      sessionSecret
    );

    if (!challenge) {
      return NextResponse.json({ error: 'Login code is missing or expired' }, { status: 401 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const providedHash = hashBrowserOtpCode(code, sessionSecret);

    if (providedHash !== challenge.codeHash) {
      const response = NextResponse.json(
        {
          error:
            challenge.attempts + 1 >= BROWSER_OTP_MAX_ATTEMPTS
              ? 'Too many invalid attempts'
              : 'Invalid code'
        },
        { status: challenge.attempts + 1 >= BROWSER_OTP_MAX_ATTEMPTS ? 429 : 401 }
      );

      if (challenge.attempts + 1 >= BROWSER_OTP_MAX_ATTEMPTS) {
        clearBrowserChallengeCookie(response);
      } else {
        attachBrowserChallengeCookie(
          response,
          createBrowserChallenge(
            {
              ...challenge,
              attempts: challenge.attempts + 1
            },
            sessionSecret
          ),
          Math.max(1, challenge.exp - nowSeconds)
        );
      }

      return response;
    }

    const response = NextResponse.json({ ok: true });
    attachSessionCookie(
      response,
      {
        authAt: nowSeconds,
        mode: 'browser',
        tgUserId: challenge.tgUserId
      },
      buildBrowserSessionTtl()
    );
    clearBrowserChallengeCookie(response);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify code' },
      { status: 500 }
    );
  }
}
