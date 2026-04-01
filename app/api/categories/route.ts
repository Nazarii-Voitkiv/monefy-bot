import { NextResponse } from 'next/server';

import { requireSession, SessionError } from '../../../src/lib/server/auth';
import { buildCategoriesData } from '../../../src/lib/server/dashboard';
import { addCategory } from '../../../src/services/categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();
    return NextResponse.json(await buildCategoriesData(session.tgUserId));
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const body = (await request.json()) as { kind?: 'expense' | 'income'; name?: string };

    if (!body.name?.trim() || !body.kind) {
      return NextResponse.json({ error: 'Missing category fields' }, { status: 400 });
    }

    const created = await addCategory(session.tgUserId, body.name, body.kind);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: 500 }
    );
  }
}
