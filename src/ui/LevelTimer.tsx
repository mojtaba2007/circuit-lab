import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** زمان‌سنج مرحله: تا زمان مرجع سبز (پاداش کامل سرعت)، بعد زرد و پس از سه برابر قرمز. */
export function LevelTimer({ startedAt, frozenMs, parSec }: { startedAt: number; frozenMs: number | null; parSec: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (frozenMs !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [frozenMs]);
  const sec = Math.max(0, Math.floor((frozenMs ?? now - startedAt) / 1000));
  const state = sec <= parSec ? 'fast' : sec < parSec * 3 ? 'slow' : 'late';
  return (
    <span className={`timer ${state}`} title={`برای پاداش کامل سرعت، در ${parSec} ثانیه حل کن`}>
      <span aria-hidden="true">⏱</span> <span dir="ltr">{pad(Math.floor(sec / 60))}:{pad(sec % 60)}</span>
      <small> / {parSec} ثانیه</small>
    </span>
  );
}
