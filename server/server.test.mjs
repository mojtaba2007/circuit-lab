import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, hashPassword, signToken, validateProgress, verifyPassword, verifyToken } from './index.mjs';

const SECRET = 'test-secret-test-secret-1234567890';
let server;
let base;
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
};
const progressWith = (score, stars = 1) => ({ results: { 'ohm-1': { score, stars } }, runs: {} });

before(async () => {
  server = createApp({ secret: SECRET, authLimit: 1000 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

describe('رمز و توکن', () => {
  test('گذرواژه با scrypt هش می‌شود و درستی‌اش بررسی می‌شود', () => {
    const h = hashPassword('secret-pass-1');
    assert.ok(!h.includes('secret-pass-1'));
    assert.ok(verifyPassword('secret-pass-1', h));
    assert.ok(!verifyPassword('secret-pass-2', h));
    assert.notEqual(hashPassword('secret-pass-1'), h); // salt متفاوت
  });
  test('توکن: امضای دست‌کاری‌شده و منقضی رد می‌شود', () => {
    const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, SECRET);
    assert.equal(verifyToken(t, SECRET)?.uid, 1);
    assert.equal(verifyToken(t + 'x', SECRET), null);
    assert.equal(verifyToken(t, 'another-secret-another-secret'), null);
    assert.equal(verifyToken(signToken({ uid: 1, exp: Date.now() - 1 }, SECRET), SECRET), null);
    assert.equal(verifyToken('garbage', SECRET), null);
  });
  test('اعتبارسنجی پیشرفت', () => {
    const ok = validateProgress({ results: { a: { score: 900, stars: 3 }, b: { score: 100, stars: 1 } }, runs: { a: { failed: 1, rounds: 0, hints: 2 } } });
    assert.ok(ok.ok);
    assert.equal(ok.totalScore, 1000);
    assert.equal(ok.totalStars, 4);
    assert.ok(validateProgress({ results: { a: { score: 1300, stars: 3 } }, runs: {} }).ok);
    assert.ok(!validateProgress({ results: { a: { score: 1301, stars: 3 } }, runs: {} }).ok);
    assert.ok(!validateProgress({ results: { a: { score: 99999, stars: 3 } }, runs: {} }).ok);
    assert.ok(!validateProgress({ results: { a: { score: 10, stars: 7 } }, runs: {} }).ok);
    assert.ok(!validateProgress({ results: { 'bad id!': { score: 1, stars: 1 } }, runs: {} }).ok);
    assert.ok(!validateProgress(null).ok);
  });
});

describe('ثبت‌نام و ورود', () => {
  test('ثبت‌نام موفق، تکراری و ورودی نامعتبر', async () => {
    const ok = await call('POST', '/api/register', { username: 'ali_1', password: 'password123' });
    assert.equal(ok.status, 201);
    assert.ok(ok.data.token);
    assert.equal(ok.data.user.username, 'ali_1');
    assert.equal((await call('POST', '/api/register', { username: 'ALI_1', password: 'password123' })).status, 409); // بدون حساسیت به بزرگی حروف
    assert.equal((await call('POST', '/api/register', { username: 'a', password: 'password123' })).status, 400);
    assert.equal((await call('POST', '/api/register', { username: 'bad name!', password: 'password123' })).status, 400);
    assert.equal((await call('POST', '/api/register', { username: 'okname', password: 'short' })).status, 400);
    assert.equal((await call('POST', '/api/register', { username: 'رضا_۱', password: 'password123' })).status, 201); // نام فارسی
  });
  test('ورود با گذرواژه درست و غلط', async () => {
    assert.equal((await call('POST', '/api/login', { username: 'ali_1', password: 'wrong-pass-1' })).status, 401);
    assert.equal((await call('POST', '/api/login', { username: 'nobody', password: 'password123' })).status, 401);
    const ok = await call('POST', '/api/login', { username: 'Ali_1', password: 'password123' });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.data.progress, { results: {}, runs: {} });
  });
});

describe('پیشرفت و حساب', () => {
  test('/api/me بدون توکن یا با توکن خراب ۴۰۱ می‌دهد', async () => {
    assert.equal((await call('GET', '/api/me')).status, 401);
    assert.equal((await call('GET', '/api/me', undefined, 'bad.token')).status, 401);
    assert.equal((await call('PUT', '/api/progress', { progress: progressWith(10) })).status, 401);
  });
  test('ذخیره و بازیابی پیشرفت؛ داده‌ی نامعتبر رد می‌شود', async () => {
    const { data } = await call('POST', '/api/register', { username: 'saver', password: 'password123' });
    const t = data.token;
    assert.equal((await call('PUT', '/api/progress', { progress: progressWith(700, 2) }, t)).status, 200);
    const me = await call('GET', '/api/me', undefined, t);
    assert.equal(me.data.progress.results['ohm-1'].score, 700);
    assert.equal((await call('PUT', '/api/progress', { progress: progressWith(5000, 3) }, t)).status, 400);
    assert.equal((await call('GET', '/api/me', undefined, t)).data.progress.results['ohm-1'].score, 700); // نامعتبر ذخیره نشد
  });
});

describe('جدول برترین‌ها', () => {
  test('فقط ۵ نفر برتر به‌ترتیب امتیاز و بدون اطلاعات حساس', async () => {
    const scores = [300, 900, 500, 1200, 100, 700, 800];
    const tokens = [];
    for (let i = 0; i < scores.length; i++) {
      const { data } = await call('POST', '/api/register', { username: `player${i}`, password: 'password123' });
      tokens.push(data.token);
      await call('PUT', '/api/progress', { progress: progressWith(scores[i], 2) }, data.token);
    }
    const lb = await call('GET', '/api/leaderboard');
    assert.equal(lb.status, 200);
    assert.equal(lb.data.top.length, 5);
    const topScores = lb.data.top.map((r) => r.score);
    assert.deepEqual(topScores, [...topScores].sort((a, b) => b - a));
    assert.equal(lb.data.top[0].username, 'player3'); // ۱۲۰۰
    assert.deepEqual(lb.data.top.map((r) => r.rank), [1, 2, 3, 4, 5]);
    assert.ok(!JSON.stringify(lb.data).includes('pass'));
    assert.equal(lb.data.me, null);
    // رتبه‌ی کاربر وارد‌شده
    const mine = await call('GET', '/api/leaderboard', undefined, tokens[0]); // player0 با ۳۰۰
    assert.equal(mine.data.me.score, 300);
    assert.ok(mine.data.me.rank > 5);
  });
});

describe('محدودیت تعداد تلاش ورود', () => {
  test('بعد از چند تلاش پشت‌سرهم ۴۲۹', async () => {
    const strict = createApp({ secret: SECRET, authLimit: 3 });
    await new Promise((r) => strict.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${strict.address().port}/api/login`;
    const codes = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'x', password: 'y' }) });
      codes.push(res.status);
    }
    strict.close();
    assert.deepEqual(codes, [401, 401, 401, 429, 429]);
  });
});
