// سرور حساب کاربری و جدول برترین‌ها — بدون هیچ وابستگی بیرونی (فقط Node 22.13+)
// اجرا: node server/index.mjs   (متغیرهای اختیاری: PORT، DB_PATH، SESSION_SECRET)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_BODY = 64 * 1024;
const MAX_LEVELS = 200;
const MAX_SCORE_PER_LEVEL = 1300; // ۱۰۰۰ امتیاز پایه + حداکثر ۳ پاداش ۱۰۰تایی (سرعت، موتور، سختی)
const USERNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- رمز و توکن ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}
/** payload توکن معتبر را برمی‌گرداند؛ در غیر این صورت null (امضای نامعتبر یا منقضی). */
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload && typeof payload.uid === 'number' && typeof payload.exp === 'number' && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

// ---------- اعتبارسنجی پیشرفت ----------
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
/** پیشرفت ارسالی از کاربر را بازسازی و جمع امتیاز/ستاره را سمت سرور حساب می‌کند. */
export function validateProgress(raw) {
  if (!raw || typeof raw !== 'object' || !raw.results || typeof raw.results !== 'object' || !raw.runs || typeof raw.runs !== 'object') {
    return { ok: false, error: 'ساختار پیشرفت نامعتبر است.' };
  }
  const ids = Object.keys(raw.results);
  if (ids.length > MAX_LEVELS || Object.keys(raw.runs).length > MAX_LEVELS) return { ok: false, error: 'تعداد مرحله‌ها زیاد است.' };
  const progress = { results: {}, runs: {} };
  let totalScore = 0;
  let totalStars = 0;
  for (const id of ids) {
    const r = raw.results[id];
    if (!/^[A-Za-z0-9-]{1,40}$/.test(id) || !r || !isInt(r.score, 0, MAX_SCORE_PER_LEVEL) || !isInt(r.stars, 0, 3)) {
      return { ok: false, error: `نتیجه‌ی مرحله‌ی «${id}» نامعتبر است.` };
    }
    progress.results[id] = { score: r.score, stars: r.stars };
    totalScore += r.score;
    totalStars += r.stars;
  }
  for (const [id, r] of Object.entries(raw.runs)) {
    if (!/^[A-Za-z0-9-]{1,40}$/.test(id) || !r || !isInt(r.failed, 0, 1000) || !isInt(r.rounds, 0, 1000) || !isInt(r.hints, 0, 50)) {
      return { ok: false, error: `وضعیت مرحله‌ی «${id}» نامعتبر است.` };
    }
    progress.runs[id] = { failed: r.failed, rounds: r.rounds, hints: r.hints };
  }
  return { ok: true, progress, totalScore, totalStars };
}

const SCHEMA = `
create table if not exists users(
  id integer primary key autoincrement,
  username text not null,
  username_lower text not null unique,
  pass_hash text not null,
  created_at integer not null
);
create table if not exists progress(
  user_id integer primary key references users(id),
  data text not null,
  total_score integer not null default 0,
  total_stars integer not null default 0,
  updated_at integer not null
);
create index if not exists idx_progress_rank on progress(total_score desc, total_stars desc);
`;
const EMPTY = { results: {}, runs: {} };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function createApp({ dbPath = ':memory:', secret, distDir, authLimit = 20 } = {}) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('secret باید دست‌کم ۱۶ نویسه باشد');
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  const q = {
    userByLower: db.prepare('select * from users where username_lower = ?'),
    userById: db.prepare('select id, username from users where id = ?'),
    insertUser: db.prepare('insert into users(username, username_lower, pass_hash, created_at) values (?,?,?,?)'),
    getProgress: db.prepare('select data from progress where user_id = ?'),
    upsertProgress: db.prepare(
      `insert into progress(user_id, data, total_score, total_stars, updated_at) values (?,?,?,?,?)
       on conflict(user_id) do update set data=excluded.data, total_score=excluded.total_score, total_stars=excluded.total_stars, updated_at=excluded.updated_at`,
    ),
    top: db.prepare(
      `select u.username as username, p.total_score as score, p.total_stars as stars from progress p join users u on u.id = p.user_id
       where p.total_score > 0 order by p.total_score desc, p.total_stars desc, p.updated_at asc limit 5`,
    ),
    mine: db.prepare('select total_score as score, total_stars as stars from progress where user_id = ?'),
    rank: db.prepare('select count(*) + 1 as rank from progress where total_score > ? or (total_score = ? and total_stars > ?)'),
  };
  const limiter = new Map();
  const limited = (ip) => {
    const now = Date.now();
    const e = limiter.get(ip);
    if (!e || e.reset < now) {
      limiter.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
      return false;
    }
    e.count += 1;
    return e.count > authLimit;
  };
  const dummyHash = hashPassword('dummy-password'); // برای یکسان‌کردن زمان پاسخ وقتی کاربر وجود ندارد

  const send = (res, status, body, extra = {}) => {
    const data = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra,
    });
    res.end(data);
  };
  const readJson = (req) =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'درخواست بیش‌ازحد بزرگ است.'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
        } catch {
          reject(new HttpError(400, 'بدنه‌ی درخواست JSON معتبر نیست.'));
        }
      });
      req.on('error', reject);
    });
  const issue = (user) => signToken({ uid: user.id, exp: Date.now() + TOKEN_TTL_MS }, secret);
  const authUser = (req, required) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const payload = m ? verifyToken(m[1], secret) : null;
    const user = payload ? q.userById.get(payload.uid) : undefined;
    if (!user && required) throw new HttpError(401, 'ابتدا وارد حساب خود شو.');
    return user;
  };
  const progressOf = (id) => {
    const row = q.getProgress.get(id);
    return row ? JSON.parse(row.data) : EMPTY;
  };
  const credentials = (body) => {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    return { username, password };
  };

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    const ip = req.socket.remoteAddress ?? 'unknown';

    if (route === 'POST /api/register') {
      if (limited(ip)) throw new HttpError(429, 'تلاش‌های زیاد؛ چند دقیقه بعد دوباره امتحان کن.');
      const { username, password } = credentials(await readJson(req));
      if (!USERNAME_RE.test(username)) throw new HttpError(400, 'نام کاربری باید ۳ تا ۲۰ حرف، عدد یا _ باشد.');
      if (password.length < 8 || password.length > 128) throw new HttpError(400, 'گذرواژه باید حداقل ۸ نویسه باشد.');
      if (q.userByLower.get(username.toLowerCase())) throw new HttpError(409, 'این نام کاربری قبلاً گرفته شده است.');
      const info = q.insertUser.run(username, username.toLowerCase(), hashPassword(password), Date.now());
      const user = { id: Number(info.lastInsertRowid), username };
      return send(res, 201, { token: issue(user), user, progress: EMPTY });
    }
    if (route === 'POST /api/login') {
      if (limited(ip)) throw new HttpError(429, 'تلاش‌های زیاد؛ چند دقیقه بعد دوباره امتحان کن.');
      const { username, password } = credentials(await readJson(req));
      const row = q.userByLower.get(username.toLowerCase());
      const ok = verifyPassword(password, row ? row.pass_hash : dummyHash);
      if (!row || !ok) throw new HttpError(401, 'نام کاربری یا گذرواژه اشتباه است.');
      const user = { id: row.id, username: row.username };
      return send(res, 200, { token: issue(user), user, progress: progressOf(row.id) });
    }
    if (route === 'GET /api/me') {
      const user = authUser(req, true);
      return send(res, 200, { user, progress: progressOf(user.id) });
    }
    if (route === 'PUT /api/progress') {
      const user = authUser(req, true);
      const body = await readJson(req);
      const v = validateProgress(body.progress);
      if (!v.ok) throw new HttpError(400, v.error);
      q.upsertProgress.run(user.id, JSON.stringify(v.progress), v.totalScore, v.totalStars, Date.now());
      return send(res, 200, { ok: true, totalScore: v.totalScore, totalStars: v.totalStars });
    }
    if (route === 'GET /api/leaderboard') {
      const user = authUser(req, false);
      const top = q.top.all().map((r, i) => ({ rank: i + 1, username: r.username, score: r.score, stars: r.stars }));
      let me = null;
      const mine = user ? q.mine.get(user.id) : undefined;
      if (mine && mine.score > 0) me = { rank: q.rank.get(mine.score, mine.score, mine.stars).rank, score: mine.score, stars: mine.stars };
      return send(res, 200, { top, me });
    }
    if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'مسیر پیدا نشد.');

    // فایل‌های ساخته‌شده‌ی رابط (npm run build) با بازگشت به index.html برای مسیرهای hash
    if (req.method === 'GET' && distDir && fs.existsSync(distDir)) {
      const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      let file = path.join(distDir, rel);
      if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
        'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      return fs.createReadStream(file).pipe(res);
    }
    throw new HttpError(404, 'پیدا نشد.');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      return send(res, 500, { error: 'خطای داخلی سرور.' });
    });
  });
  server.on('close', () => db.close());
  return server;
}

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(here, '.secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const app = createApp({ dbPath: process.env.DB_PATH ?? path.join(here, 'data.sqlite'), secret: loadSecret(), distDir: path.join(here, '..', 'dist') });
  app.listen(port, () => console.log(`circuit-lab server was run on http://localhost:${port}.`));
}
