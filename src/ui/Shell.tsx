import type { ReactNode } from 'react';
import type { SyncState, User } from '../auth/api';
import { totalScore, totalStars, type Progress } from '../levels/progress';
import { href, type Route } from '../routes';
import { Logo } from './icons';

const SYNC_TEXT: Record<SyncState, string> = { idle: '', saving: 'در حال ذخیره…', ok: '✓ ذخیره شد', error: '⚠ ذخیره نشد' };

interface Props {
  route: Route;
  progress: Progress;
  user: User | null;
  sync: SyncState;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ route, progress, user, sync, onLogout, children }: Props) {
  const active = route.name === 'play' ? 'roadmap' : route.name;
  const links: { id: Route['name']; label: string; to: string }[] = [
    { id: 'home', label: 'خانه', to: href.home },
    { id: 'roadmap', label: 'نقشه مراحل', to: href.roadmap },
    { id: 'free', label: 'حالت آزاد', to: href.free },
  ];
  return (
    <div className="shell">
      <a className="skip" href="#main">رفتن به محتوا</a>
      <header className="appbar">
        <a className="brand" href={href.home}><Logo /><span>آزمایشگاه مدار</span></a>
        <nav aria-label="ناوبری اصلی">
          {links.map((l) => <a key={l.id} href={l.to} aria-current={active === l.id ? 'page' : undefined}>{l.label}</a>)}
        </nav>
        <div className="stats">
          <span className="chip star" aria-label="ستاره‌ها">★ {totalStars(progress)}</span>
          <span className="chip score-chip">{totalScore(progress)} امتیاز</span>
          {user ? (
            <>
              <a className="chip user-chip" href={href.login} aria-label={`حساب ${user.username}`}>👤 {user.username}</a>
              <span className={`sync ${sync}`} role="status">{SYNC_TEXT[sync]}</span>
              <button className="icon-btn" onClick={onLogout} title="خروج از حساب" aria-label="خروج از حساب">⏻</button>
            </>
          ) : (
            <a className="btn primary sm" href={href.login} aria-current={route.name === 'login' ? 'page' : undefined}>ورود / ثبت‌نام</a>
          )}
        </div>
      </header>
      <div id="main" className="content" tabIndex={-1}>{children}</div>
    </div>
  );
}
