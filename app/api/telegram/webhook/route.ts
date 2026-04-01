import { NextResponse } from 'next/server';

import { getBot, resetBot } from '../../../../src/bot/runtime';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;
export const runtime = 'nodejs';

async function initializeBot(): Promise<Response> {
  await getBot();
  return NextResponse.json({ initialized: true, ok: true });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('init') === '1') {
      return await initializeBot();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    resetBot();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook init failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const update: unknown = await request.json();
    if (typeof update !== 'object' || update === null) {
      return NextResponse.json({ error: 'Missing update body' }, { status: 400 });
    }

    const bot = await getBot();
    await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0]);
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    resetBot();
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Webhook handling failed'
      },
      { status: 500 }
    );
  }
}
