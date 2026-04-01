import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  allowedUserIds,
  assertProductionEnv,
  sessionSecret
} from '../../../../../src/config/env';
import {
  BROWSER_OTP_COOLDOWN_SECONDS,
  BROWSER_OTP_TTL_SECONDS,
  createBrowserChallenge,
  generateBrowserOtpCode,
  getBrowserOtpThrottleRemaining,
  hashBrowserOtpCode,
  touchBrowserOtpThrottle,
  verifyBrowserChallenge
} from '../../../../../src/lib/browser-auth';
import {
  attachBrowserChallengeCookie
} from '../../../../../src/lib/server/auth';
import { sendTelegramMessage } from '../../../../../src/lib/server/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  try {
    assertProductionEnv();

    const targetUserId = allowedUserIds[0];
    if (!targetUserId) {
      return NextResponse.json({ error: 'No allowed Telegram user configured' }, { status: 500 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const cookieStore = await cookies();
    const currentChallenge = verifyBrowserChallenge(
      cookieStore.get('monefy_browser_challenge')?.value,
      sessionSecret
    );

    const cookieRetryAfter =
      currentChallenge && currentChallenge.sentAt + BROWSER_OTP_COOLDOWN_SECONDS > nowSeconds
        ? currentChallenge.sentAt + BROWSER_OTP_COOLDOWN_SECONDS - nowSeconds
        : 0;
    const throttleRetryAfter = getBrowserOtpThrottleRemaining(targetUserId, nowSeconds);
    const retryAfter = Math.max(cookieRetryAfter, throttleRetryAfter);

    if (retryAfter > 0) {
      return NextResponse.json(
        {
          error: 'Please wait before requesting another code',
          retryAfter
        },
        { status: 429 }
      );
    }

    const code = generateBrowserOtpCode();
    const response = NextResponse.json({
      cooldownSeconds: BROWSER_OTP_COOLDOWN_SECONDS,
      expiresInSeconds: BROWSER_OTP_TTL_SECONDS,
      ok: true
    });

    await sendTelegramMessage(
      targetUserId,
      [
        'Твій код входу в Monefy:',
        '',
        code,
        '',
        'Код діє 30 хвилин.'
      ].join('\n')
    );
    touchBrowserOtpThrottle(targetUserId, nowSeconds);

    attachBrowserChallengeCookie(
      response,
      createBrowserChallenge(
        {
          attempts: 0,
          codeHash: hashBrowserOtpCode(code, sessionSecret),
          exp: nowSeconds + BROWSER_OTP_TTL_SECONDS,
          sentAt: nowSeconds,
          tgUserId: targetUserId
        },
        sessionSecret
      ),
      BROWSER_OTP_TTL_SECONDS
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send code' },
      { status: 500 }
    );
  }
}
