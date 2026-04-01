import { NextResponse } from 'next/server';

import { requireSession,SessionError } from '../../../src/lib/server/auth';
import { buildTransactionsData } from '../../../src/lib/server/dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '20');
    const payload = await buildTransactionsData(session.tgUserId, page, limit);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load transactions' },
      { status: 500 }
    );
  }
}
