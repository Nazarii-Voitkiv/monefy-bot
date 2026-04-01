import { NextResponse } from 'next/server';

import { requireSession, SessionError } from '../../../../src/lib/server/auth';
import { mapTransactions } from '../../../../src/lib/server/dashboard';
import { getCategoryById, listCategories } from '../../../../src/services/categories';
import { fxProvider } from '../../../../src/services/fxProvider';
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction
} from '../../../../src/services/transactions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTxnDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
      return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
    }

    const body = (await request.json()) as {
      amount?: number;
      categoryId?: number;
      currency?: 'PLN' | 'UAH' | 'USD';
      note?: string | null;
      sign?: 1 | -1;
      txnAt?: string;
    };

    if (body.categoryId) {
      const category = await getCategoryById(session.tgUserId, body.categoryId);
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
    }

    const txnDate = parseTxnDate(body.txnAt);
    const updated = await updateTransaction(
      id,
      session.tgUserId,
      {
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        categoryId: body.categoryId,
        currency: body.currency,
        note: body.note === undefined ? undefined : body.note?.trim() || null,
        rateDate: txnDate ? txnDate.toISOString().slice(0, 10) : undefined,
        sign: body.sign,
        txnDate
      },
      fxProvider
    );

    const categoryNames = new Map((await listCategories(session.tgUserId)).map((item) => [item.id, item.name]));

    return NextResponse.json(mapTransactions([updated], categoryNames)[0]);
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update transaction' },
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
      return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
    }

    const existing = await getTransactionById(id, session.tgUserId);
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    await deleteTransaction(id, session.tgUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
