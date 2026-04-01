import { NextResponse } from 'next/server';

import { requireSession,SessionError } from '../../../src/lib/server/auth';
import { buildDashboardData } from '../../../src/lib/server/dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const payload = await buildDashboardData(
      session.tgUserId,
      searchParams.get('period')
    );

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
