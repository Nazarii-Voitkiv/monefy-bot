import { NextResponse } from 'next/server';

import { getSession, SessionError } from '../../../../src/lib/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: session.tgUserId,
        mode: session.mode
      }
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load session' },
      { status: 500 }
    );
  }
}
