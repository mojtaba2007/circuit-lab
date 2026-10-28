import { useEffect } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { User } from '../auth/api';
import { FUTURE_WORLDS, LEVELS, WORLD_INFO } from '../levels/data';
import { isCompleted, isUnlocked, nextLevelIndex, totalScore, totalStars, type Progress } from '../levels/progress';
import type { LevelType } from '../levels/types';
import { href } from '../routes';
import { Difficulty, TYPE_META, TypeGlyph, TypeIcon } from '../ui/icons';
import { Leaderboard } from '../ui/Leaderboard';
import { BatteryArt, LampArt, RailSymbol, Ring, ZoneArt } from '../ui/RoadmapArt';
import { buildZones, pairRows, type ZoneModel } from './roadmapModel';

interface ZoneProps {
  zone: ZoneModel;
  side: 'a' | 'b';
  done: boolean[];
  current: number;
  progress: Progress;
}

function Zone({ zone, side, done, current, progress }: ZoneProps) {
  const pct = (zone.done / zone.count) * 100;
  const items: ReactElement[] = [];
  for (let k = 0; k < zone.count; k++) {
    const g = zone.first + k;
    const l = LEVELS[g];
    const unlocked = isUnlocked(LEVELS, progress, g);
    const state = done[g] ? 'done' : g === current ? 'current' : unlocked ? 'open' : 'locked';
    const res = progress.results[l.id];
    const label = `مرحله ${g + 1}: ${l.title} (${TYPE_META[l.type].label}، سختی ${['', 'آسان', 'متوسط', 'سخت'][l.difficulty ?? 1]})${res ? `، ${res.stars} ستاره، ${res.score} امتیاز` : ''}${unlocked ? '' : '، قفل'}`;
    const card = (
      <>
        <span className="lv-socket">
          {state === 'done' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.5 4.5 8.5-10" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : state === 'locked' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="11" width="12" height="9" rx="2.5" /><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><TypeGlyph type={l.type} /></svg>
          )}
          <b className="lv-no">{g + 1}</b>
        </span>
        <span className="lv-card">
          <span className="lv-main">
            <strong>{l.title}</strong>
            <small><TypeIcon type={l.type} size={14} />{TYPE_META[l.type].label}<Difficulty level={l.difficulty ?? 1} compact /></small>
          </span>
          <span className="lv-meta">
            {res ? <><span className="stars">{'★'.repeat(res.stars)}{'☆'.repeat(3 - res.stars)}</span><br />{res.score}</> : state === 'current' ? <b className="go">شروع ←</b> : null}
          </span>
        </span>
      </>
    );
    items.push(
      <li key={l.id} id={state === 'current' ? 'current-level' : undefined} className={`lv ${state} t-${l.type}${g === 0 || done[g - 1] ? ' in-on' : ''}${done[g] ? ' out-on' : ''}`}>
        {unlocked
          ? <a className="lv-row" href={href.play(l.id)} aria-label={label} aria-current={state === 'current' ? 'step' : undefined}>{card}</a>
          : <div className="lv-row" role="img" aria-label={label}>{card}</div>}
      </li>,
    );
    const part = zone.spec.parts.find((p) => p.after === k);
    if (part) items.push(<li key={`${l.id}-part`} className={`rail-part${done[g] ? ' on' : ''}`} aria-hidden="true"><RailSymbol kind={part.kind} /></li>);
  }
  return (
    <section className={`zone z${side} ${zone.state}${zone.energized ? ' in' : ''}`} style={{ '--z': zone.spec.color } as CSSProperties} aria-labelledby={`zone-${zone.index}`}>
      <i className="tap" aria-hidden="true" />
      <header className="z-head">
        <ZoneArt kind={zone.spec.art} pct={pct} />
        <div className="z-title">
          <span className="z-num">جهان {zone.index + 1}</span>
          <h2 id={`zone-${zone.index}`}>{zone.spec.world}</h2>
          <p>{WORLD_INFO[zone.spec.world] ?? ''}</p>
        </div>
        <Ring pct={pct}>{zone.done}/{zone.count}</Ring>
      </header>
      <ol className="z-levels">{items}</ol>
    </section>
  );
}

export default function Roadmap({ progress, user, savedAt }: { progress: Progress; user: User | null; savedAt: number }) {
  const n = LEVELS.length;
  const done = LEVELS.map((l) => isCompleted(progress, l.id));
  const current = nextLevelIndex(LEVELS, progress);
  const doneCount = done.filter(Boolean).length;
  const pct = (doneCount / n) * 100;
  const zones = buildZones(LEVELS, done, (i) => isUnlocked(LEVELS, progress, i));
  const rows = pairRows(zones);
  const types = Object.keys(TYPE_META) as LevelType[];
  const allDone = doneCount === n;

  // با ورود به صفحه، مرحله‌ی فعلی در وسط دید قرار می‌گیرد
  useEffect(() => {
    if (doneCount > 0) document.getElementById('current-level')?.scrollIntoView({ block: 'center' });
    // فقط یک بار موقع باز شدن صفحه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page roadmap">
      <section className="card rm-hero">
        <Ring pct={pct} size={116} stroke={9}><b>{Math.round(pct)}٪</b><small>کامل شد</small></Ring>
        <div className="rm-hero-text">
          <h1>نقشه‌ی مراحل</h1>
          <p className="muted">از باتری شروع کن و جهان‌ها را یکی‌یکی روشن کن؛ با کامل‌شدن مدار، لامپ پایانی روشن می‌شود.</p>
          <div className="rm-stats">
            <span className="chip star">★ {totalStars(progress)} / {n * 3}</span>
            <span className="chip">{totalScore(progress)} امتیاز</span>
            <span className="chip">{doneCount} از {n} مرحله</span>
          </div>
        </div>
        {current >= 0 && <a className="btn primary lg" href={href.play(LEVELS[current].id)}>{doneCount === 0 ? 'شروع بازی' : 'ادامه: مرحله'} {current + 1}</a>}
      </section>

      <ul className="rm-legend" aria-label="انواع چالش">
        {types.map((t) => <li key={t} className={`type-badge t-${t}`}><TypeIcon type={t} size={16} />{TYPE_META[t].label}</li>)}
      </ul>

      <div className="circuit">
        <div className="c-cap start">
          <BatteryArt />
          <div><h3>شروع: منبع ولتاژ</h3><p>جریان از اینجا وارد مدار می‌شود.</p></div>
        </div>
        <div className="c-link on" aria-hidden="true" />
        {rows.map(([a, b], r) => {
          const lastIdx = (b ?? a).first + (b ?? a).count - 1;
          return (
            <div key={a.index}>
              <div className="c-row">
                <Zone zone={a} side="a" done={done} current={current} progress={progress} />
                <div className={`c-spine${a.energized ? ' on' : ''}`} aria-hidden="true" />
                {b ? <Zone zone={b} side="b" done={done} current={current} progress={progress} /> : <div className="zb ghost" aria-hidden="true" />}
              </div>
              <div className={`c-link${done[lastIdx] ? ' on' : ''}`} aria-hidden="true" data-row={r} />
            </div>
          );
        })}
        <div className={`c-cap end${allDone ? ' lit' : ''}`}>
          <LampArt on={allDone} />
          <div><h3>{allDone ? 'آفرین! مدار کامل شد' : 'هدف نهایی: لامپ'}</h3><p>{allDone ? 'همه‌ی جهان‌ها را روشن کردی و لامپ روشن شد.' : 'با حل همه‌ی مرحله‌ها لامپ روشن می‌شود.'}</p></div>
        </div>
      </div>

      <div className="rm-bottom">
        <Leaderboard user={user} refreshKey={savedAt} />
        <section className="future" aria-label="جهان‌های آینده">
          <h2>به‌زودی</h2>
          {FUTURE_WORLDS.map((w) => (
            <div className="future-card" key={w.name}>
              <div><h3>{w.name}</h3><p className="muted small">{w.topics.join(' · ')}</p></div>
              <span className="chip">به‌زودی</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
