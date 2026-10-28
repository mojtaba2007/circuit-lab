import type { Level } from './types';

export interface LevelResult {
  score: number;
  stars: number;
}
/** وضعیت دور جاری یک مرحله؛ ذخیره می‌شود تا با رفرش صفحه تلاش‌ها برنگردند. */
export interface LevelRun {
  failed: number;
  rounds: number;
  hints: number;
}
export interface Progress {
  results: Record<string, LevelResult>;
  runs: Record<string, LevelRun>;
}

const LEGACY_KEY = 'circuit-lab-progress-v2';
/** پیشرفت هر کاربر جدا ذخیره می‌شود ('guest' برای مهمان) تا با تعویض حساب قاطی نشود. */
const storageKey = (owner: string) => `${LEGACY_KEY}:${owner}`;
export const emptyProgress = (): Progress => ({ results: {}, runs: {} });

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** هر ورودی ناشناخته (localStorage یا سرور) را به یک Progress سالم تبدیل می‌کند. */
export function sanitizeProgress(raw: unknown): Progress {
  const out = emptyProgress();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { results?: unknown; runs?: unknown };
  if (r.results && typeof r.results === 'object') {
    for (const [id, v] of Object.entries(r.results as Record<string, Partial<LevelResult>>)) {
      if (v && num(v.score) && num(v.stars)) out.results[id] = { score: v.score, stars: v.stars };
    }
  }
  if (r.runs && typeof r.runs === 'object') {
    for (const [id, v] of Object.entries(r.runs as Record<string, Partial<LevelRun>>)) {
      if (v && num(v.failed) && num(v.rounds) && num(v.hints)) out.runs[id] = { failed: v.failed, rounds: v.rounds, hints: v.hints };
    }
  }
  return out;
}

export function loadProgress(owner = 'guest'): Progress {
  try {
    const raw = localStorage.getItem(storageKey(owner)) ?? (owner === 'guest' ? localStorage.getItem(LEGACY_KEY) : null);
    return raw ? sanitizeProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(p: Progress, owner = 'guest'): void {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(p));
  } catch {
    /* حالت خصوصی مرورگر یا پر بودن حافظه: نادیده می‌گیریم */
  }
}

/** ادغام دو پیشرفت: بهترین نتیجه‌ی هر مرحله می‌ماند و در تعارض دور جاری primary برنده است. */
export function mergeProgress(primary: Progress, other: Progress): Progress {
  const results: Record<string, LevelResult> = { ...other.results };
  for (const [id, r] of Object.entries(primary.results)) {
    const o = results[id];
    results[id] = !o || r.score > o.score || (r.score === o.score && r.stars >= o.stars) ? r : o;
  }
  return { results, runs: { ...other.runs, ...primary.runs } };
}

export const isCompleted = (p: Progress, id: string): boolean => id in p.results;
export const getRun = (p: Progress, id: string): LevelRun => p.runs[id] ?? { failed: 0, rounds: 0, hints: 0 };
/** مرحله اول همیشه باز است؛ هر مرحله بعد از حل مرحله قبلی باز می‌شود. */
export const isUnlocked = (levels: Level[], p: Progress, i: number): boolean =>
  i === 0 || isCompleted(p, levels[i - 1].id);
/** اندیس اولین مرحله حل‌نشده؛ اگر همه حل شده باشند -1 */
export const nextLevelIndex = (levels: Level[], p: Progress): number =>
  levels.findIndex((l) => !isCompleted(p, l.id));
export const totalStars = (p: Progress): number => Object.values(p.results).reduce((a, r) => a + r.stars, 0);
export const totalScore = (p: Progress): number => Object.values(p.results).reduce((a, r) => a + r.score, 0);

// ---- تغییرهای وضعیت (توابع خالص، قابل تست) ----
const withRun = (p: Progress, id: string, run: LevelRun): Progress => ({ ...p, runs: { ...p.runs, [id]: run } });

export const recordFail = (p: Progress, id: string): Progress => {
  const r = getRun(p, id);
  return withRun(p, id, { ...r, failed: r.failed + 1 });
};
export const recordHint = (p: Progress, id: string, max: number): Progress => {
  const r = getRun(p, id);
  return r.hints >= max ? p : withRun(p, id, { ...r, hints: r.hints + 1 });
};
/** دور جدید: تلاش‌ها برمی‌گردند ولی ضریب امتیاز کم می‌شود (راهنماهای دیده‌شده می‌مانند). */
export const startNewRound = (p: Progress, id: string): Progress => {
  const r = getRun(p, id);
  return withRun(p, id, { ...r, failed: 0, rounds: r.rounds + 1 });
};
/** ثبت برد: بهترین امتیاز نگه داشته می‌شود و دور جاری از نو شروع می‌شود. */
export const recordSuccess = (p: Progress, id: string, result: LevelResult): Progress => {
  const best = p.results[id];
  const keep = best && best.score >= result.score ? best : result;
  return withRun({ ...p, results: { ...p.results, [id]: keep } }, id, { failed: 0, rounds: 0, hints: 0 });
};
