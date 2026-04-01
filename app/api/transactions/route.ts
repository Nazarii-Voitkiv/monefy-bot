import { NextResponse } from 'next/server';

import { requireSession, SessionError } from '../../../src/lib/server/auth';
import { buildTransactionsData, mapTransactions } from '../../../src/lib/server/dashboard';
import { parseTransactionsQuery } from '../../../src/lib/server/transactions-query';
import { getCategoryById } from '../../../src/services/categories';
import { listCategories } from '../../../src/services/categories';
import { fxProvider } from '../../../src/services/fxProvider';
import { createTransaction } from '../../../src/services/transactions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseTxnDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const payload = await buildTransactionsData(session.tgUserId, parseTransactionsQuery(searchParams));

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

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      amount?: number;
      categoryId?: number;
      currency?: 'PLN' | 'UAH' | 'USD';
      note?: string;
      sign?: 1 | -1;
      txnAt?: string;
    };

    if (!body.categoryId || !body.sign || !body.currency || typeof body.amount !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const txnDate = parseTxnDate(body.txnAt);
    if (!txnDate) {
      return NextResponse.json({ error: 'Invalid transaction date' }, { status: 400 });
    }

    const category = await getCategoryById(session.tgUserId, body.categoryId);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const created = await createTransaction({
      amount: body.amount,
      category,
      currency: body.currency,
      fxProvider,
      note: body.note?.trim() || null,
      rateDate: txnDate.toISOString().slice(0, 10),
      sign: body.sign,
      tgUserId: session.tgUserId,
      txnDate
    });

    const categoryNames = new Map((await listCategories(session.tgUserId)).map((item) => [item.id, item.name]));

    return NextResponse.json(mapTransactions([created], categoryNames)[0], { status: 201 });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
