import { NextResponse } from 'next/server';

import {
  allowedUserIds,
  assertProductionEnv,
  env,
  isDev
} from '../../../../src/config/env';
import { attachSessionCookie } from '../../../../src/lib/server/auth';
import { validateTelegramInitData } from '../../../../src/lib/telegram-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAllowedUser(tgUserId: string): boolean {
  return allowedUserIds.includes(tgUserId);
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertProductionEnv();

    const body = (await request.json()) as { initData?: string };
    const initData = body.initData?.trim() ?? '';
    const authAt = Math.floor(Date.now() / 1000);

    let sessionUserId: string;
    let mode: 'development' | 'telegram';
    let profile: { firstName?: string; username?: string };

    if (!initData) {
      if (!isDev || !env.DEV_TELEGRAM_USER_ID) {
        return NextResponse.json(
          { error: 'Telegram initData is required' },
          { status: 401 }
        );
      }

      sessionUserId = env.DEV_TELEGRAM_USER_ID;
      mode = 'development';
      profile = {};
    } else {
      const validated = validateTelegramInitData(initData, env.BOT_TOKEN);
      sessionUserId = String(validated.user.id);
      mode = 'telegram';
      profile = {
        firstName: validated.user.first_name,
        username: validated.user.username
      };
    }

    if (!isAllowedUser(sessionUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: sessionUserId,
        ...profile
      }
    });

    attachSessionCookie(response, {
      authAt,
      mode,
      tgUserId: sessionUserId
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Authentication failed'
      },
      { status: 401 }
    );
  }
}
