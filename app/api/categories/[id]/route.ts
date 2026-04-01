import { NextResponse } from 'next/server';

import { requireSession, SessionError } from '../../../../src/lib/server/auth';
import {
  getCategoryById,
  removeCategoryById,
  renameCategory
} from '../../../../src/services/categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await requireSession();
    const params = await context.params;
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
    }

    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const existing = await getCategoryById(session.tgUserId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(await renameCategory(session.tgUserId, id, body.name));
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await requireSession();
    const params = await context.params;
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
    }

    const existing = await getCategoryById(session.tgUserId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await removeCategoryById(session.tgUserId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete category' },
      { status: 500 }
    );
  }
}
