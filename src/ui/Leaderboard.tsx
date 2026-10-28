import { useCallback, useEffect, useState } from 'react';
import { api, type LeaderboardData, type User } from '../auth/api';
import { href } from '../routes';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: LeaderboardData };
const MEDAL = ['🥇', '🥈', '🥉'];

/** ۵ نفر برتر بر اساس مجموع امتیاز (و در تساوی، ستاره). با هر ذخیره‌ی موفق دوباره بارگذاری می‌شود. */
export function Leaderboard({ user, refreshKey }: { user: User | null; refreshKey: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    api.leaderboard().then(
      (data) => setState({ status: 'ok', data }),
      (e: unknown) => setState({ status: 'error', message: e instanceof Error ? e.message : 'خطا در دریافت جدول' }),
    );
  }, []);
  useEffect(() => { load(); }, [load, refreshKey, user?.id]);

  return (
    <section className="card leaderboard" aria-labelledby="lb-title">
      <div className="goal-head">
        <h2 id="lb-title">🏆 ۵ نفر برتر</h2>
        <button className="icon-btn" onClick={() => { setState({ status: 'loading' }); load(); }} aria-label="تازه‌سازی جدول" title="تازه‌سازی">↻</button>
      </div>
      {state.status === 'loading' && <p className="muted">در حال بارگذاری…</p>}
      {state.status === 'error' && <p className="muted">{state.message}</p>}
      {state.status === 'ok' && (
        <>
          {state.data.top.length === 0 ? (
            <p className="muted">هنوز کسی امتیاز ثبت نکرده است؛ اولین نفر تو باش!</p>
          ) : (
            <ol className="lb-list">
              {state.data.top.map((r) => (
                <li key={r.rank} className={user && r.username === user.username ? 'me' : ''}>
                  <span className="lb-rank" aria-label={`رتبه ${r.rank}`}>{MEDAL[r.rank - 1] ?? r.rank}</span>
                  <span className="lb-name">{r.username}</span>
                  <span className="lb-stars">★ {r.stars}</span>
                  <b className="lb-score">{r.score}</b>
                </li>
              ))}
            </ol>
          )}
          {user && state.data.me && !state.data.top.some((r) => r.username === user.username) && (
            <p className="lb-me">رتبه‌ی تو: <b>{state.data.me.rank}</b> · {state.data.me.score} امتیاز</p>
          )}
          {!user && <p className="muted small"><a href={href.login}>وارد شو</a> تا امتیازهایت ذخیره شود و در این جدول بیایی.</p>}
        </>
      )}
    </section>
  );
}
