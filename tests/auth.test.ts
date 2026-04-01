import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSession,
  SESSION_TTL_SECONDS,
  verifySession
} from '../src/lib/session';
import {
  buildTelegramHash,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  validateTelegramInitData
} from '../src/lib/telegram-auth';

const BOT_TOKEN = '123456:ABCDEF';
const SESSION_SECRET = 'test-secret';
const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

function buildInitData({
  authDate,
  userId
}: {
  authDate: number;
  userId: number;
}): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');
  params.set(
    'user',
    JSON.stringify({
      first_name: 'Nazarii',
      id: userId,
      username: 'nazarii'
    })
  );
  params.set('hash', buildTelegramHash(params, BOT_TOKEN));
  return params.toString();
}

test('validates Telegram initData payload', () => {
  const authDate = Math.floor(NOW / 1000);
  const payload = validateTelegramInitData(
    buildInitData({ authDate, userId: 489177683 }),
    BOT_TOKEN,
    NOW
  );

  assert.equal(payload.user.id, 489177683);
  assert.equal(payload.authDate, authDate);
});

test('validates Telegram initData payload when signature is present', () => {
  const authDate = Math.floor(NOW / 1000);
  const params = new URLSearchParams(buildInitData({ authDate, userId: 489177683 }));
  params.set('signature', 'base64url-signature-from-telegram');
  params.set('hash', buildTelegramHash(params, BOT_TOKEN));

  const payload = validateTelegramInitData(params.toString(), BOT_TOKEN, NOW);

  assert.equal(payload.user.id, 489177683);
  assert.equal(payload.authDate, authDate);
});

test('rejects expired Telegram initData payload', () => {
  const authDate = Math.floor((NOW - (TELEGRAM_AUTH_MAX_AGE_SECONDS + 1) * 1000) / 1000);

  assert.throws(
    () =>
      validateTelegramInitData(
        buildInitData({ authDate, userId: 489177683 }),
        BOT_TOKEN,
        NOW
      ),
    /expired/
  );
});

test('rejects tampered Telegram initData payload', () => {
  const authDate = Math.floor(NOW / 1000);
  const initData = buildInitData({ authDate, userId: 489177683 }).replace(
    'Nazarii',
    'Intruder'
  );

  assert.throws(() => validateTelegramInitData(initData, BOT_TOKEN, NOW), /invalid/);
});

test('creates and verifies signed session cookies', () => {
  const authAt = Math.floor(NOW / 1000);
  const token = createSession(
    {
      authAt,
      exp: authAt + SESSION_TTL_SECONDS,
      mode: 'telegram',
      tgUserId: '489177683'
    },
    SESSION_SECRET
  );

  const payload = verifySession(token, SESSION_SECRET, NOW);

  assert.deepEqual(payload, {
    authAt,
    exp: authAt + SESSION_TTL_SECONDS,
    mode: 'telegram',
    tgUserId: '489177683'
  });
});

test('rejects expired signed session cookies', () => {
  const authAt = Math.floor(NOW / 1000) - SESSION_TTL_SECONDS - 1;
  const token = createSession(
    {
      authAt,
      exp: authAt + SESSION_TTL_SECONDS,
      mode: 'telegram',
      tgUserId: '489177683'
    },
    SESSION_SECRET
  );

  assert.equal(verifySession(token, SESSION_SECRET, NOW), null);
});
