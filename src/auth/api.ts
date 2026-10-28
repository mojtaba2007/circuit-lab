import { sanitizeProgress, type Progress } from '../levels/progress';

export interface User {
  id: number;
  username: string;
}
export interface Session {
  token: string;
  user: User;
  progress: Progress;
}
export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
  stars: number;
}
export interface LeaderboardData {
  top: LeaderboardRow[];
  me: { rank: number; score: number; stars: number } | null;
}
export type SyncState = 'idle' | 'saving' | 'ok' | 'error';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'circuit-lab-token';
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* حالت خصوصی مرورگر */
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError('اتصال به سرور برقرار نشد. سرور را اجرا کن (npm run server).', 0);
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? 'خطای نامشخص از سرور.', res.status);
  return data as T;
}

interface RawSession {
  token: string;
  user: User;
  progress: unknown;
}
const toSession = (r: RawSession): Session => ({ token: r.token, user: r.user, progress: sanitizeProgress(r.progress) });

export const api = {
  register: async (username: string, password: string) =>
    toSession(await request<RawSession>('/api/register', { method: 'POST', body: { username, password } })),
  login: async (username: string, password: string) =>
    toSession(await request<RawSession>('/api/login', { method: 'POST', body: { username, password } })),
  me: async () => {
    const r = await request<{ user: User; progress: unknown }>('/api/me');
    return { user: r.user, progress: sanitizeProgress(r.progress) };
  },
  saveProgress: (progress: Progress) => request<{ ok: boolean }>('/api/progress', { method: 'PUT', body: { progress } }),
  leaderboard: () => request<LeaderboardData>('/api/leaderboard'),
};

export const USERNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;
