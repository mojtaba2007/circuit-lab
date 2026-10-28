import { useEffect, useMemo, useState } from 'react';
import { formatValue, parseValue, toInputText } from '../engine';
import { analyze } from '../editor/analyze';
import { addPart, removePart, samePoint, setInitial, setValue, UNIT, type Circuit, type Part, type PartKind, type Point } from '../editor/model';
import { evaluateGoal, feedbackFor } from '../levels/evaluate';
import { getRun, type LevelResult, type Progress } from '../levels/progress';
import { attemptsFor, computeScore, parSeconds, type ScoreBreakdown } from '../levels/scoring';
import type { InteractiveLevel } from '../levels/types';
import { href } from '../routes';
import { Board } from '../ui/Board';
import { Difficulty, ToolIcon, TypeBadge } from '../ui/icons';
import { GoalCard, LessonCard } from '../ui/LevelPanel';
import { LevelTimer } from '../ui/LevelTimer';
import { TransientPanel } from '../ui/TransientPanel';
import { useHistory } from '../ui/useHistory';

type Tool = PartKind | 'G' | 'S' | 'X';
const TOOL_GROUPS: { label: string; tools: { id: Tool; label: string; key: string }[] }[] = [
  {
    label: 'قطعه‌ها',
    tools: [
      { id: 'R', label: 'مقاومت', key: 'R' }, { id: 'V', label: 'باتری', key: 'V' }, { id: 'I', label: 'منبع جریان', key: 'I' },
      { id: 'C', label: 'خازن', key: 'C' }, { id: 'L', label: 'سلف', key: 'L' },
    ],
  },
  { label: 'اتصال', tools: [{ id: 'W', label: 'سیم', key: 'W' }, { id: 'G', label: 'زمین', key: 'G' }] },
  { label: 'ویرایش', tools: [{ id: 'S', label: 'انتخاب', key: 'S' }, { id: 'X', label: 'حذف', key: 'X' }] },
];
const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
const SANDBOX: Circuit = {
  ground: [3, 9],
  parts: [
    { id: 'E1', kind: 'V', a: [3, 3], b: [3, 9], value: 10 },
    { id: 'R1', kind: 'R', a: [3, 3], b: [8, 3], value: 3000 },
    { id: 'R2', kind: 'R', a: [8, 3], b: [8, 9], value: 1000 },
    { id: 'W1', kind: 'W', a: [8, 9], b: [3, 9], value: 0 },
  ],
};
const NO_LOCK: ReadonlySet<string> = new Set();
const defaultTool = (level: InteractiveLevel | null): Tool => (!level ? 'R' : level.type === 'tune' ? 'S' : level.type === 'repair' ? 'W' : 'R');

const SLIDER = {
  R: { min: 0, max: 5, step: 0.004, to: (x: number) => 10 ** x, from: (v: number) => Math.log10(v) },
  V: { min: 0.5, max: 48, step: 0.5, to: (x: number) => x, from: (v: number) => v },
  I: { min: 0.001, max: 0.1, step: 0.001, to: (x: number) => x, from: (v: number) => v },
  C: { min: -9, max: -3, step: 0.004, to: (x: number) => 10 ** x, from: (v: number) => Math.log10(v) }, // ۱ نانو تا ۱ میلی فاراد
  L: { min: -6, max: 1, step: 0.004, to: (x: number) => 10 ** x, from: (v: number) => Math.log10(v) }, // ۱ میکرو تا ۱۰ هانری
};

/** ورودی مقدار تایپی (حالت مسابقه): بدون اسلایدر، با اعمال صریح؛ نتیجه‌ی زنده نشان داده نمی‌شود. */
function ValueField({ part, onApply }: { part: Part; onApply: (v: number) => void }) {
  const shown = toInputText(part.value);
  const [text, setText] = useState(shown);
  const [error, setError] = useState('');
  useEffect(() => {
    setText(shown);
    setError('');
  }, [part.id, shown]);
  const apply = () => {
    const v = parseValue(text);
    if (!(v > 0)) { setError('مقدار نامعتبر است؛ مثال: 4.7k ، 10m ، 2u'); return; }
    setError('');
    if (v !== part.value) onApply(v);
  };
  return (
    <div className="valuefield">
      <label>
        مقدار جدید ({UNIT[part.kind]})
        <span className="vf-row">
          <input value={text} dir="ltr" inputMode="decimal" autoComplete="off" aria-label={`مقدار ${part.id}`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
          <button onClick={apply}>اعمال</button>
        </span>
      </label>
      <div className="muted small">مقدار فعلی: <b dir="ltr">{formatValue(part.value, UNIT[part.kind])}</b> · مثال: 4.7k ، 10m ، 2u</div>
      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}

export function Inspector({ part, locked, typed, onChange, onInitial }: { part: Part; locked: boolean; typed: boolean; onChange: (v: number, merge: boolean) => void; onInitial: (v: number) => void }) {
  if (part.kind === 'W') return null;
  const s = SLIDER[part.kind];
  return (
    <section className="card">
      <h2>تنظیم {part.id}</h2>
      {locked ? (
        <p className="muted">🔒 مقدار این قطعه در این مرحله قفل است.</p>
      ) : (
        <>
          {typed ? (
            <ValueField part={part} onApply={(v) => onChange(v, false)} />
          ) : (
            <>
              <input
                type="range" aria-label={`مقدار ${part.id}`} min={s.min} max={s.max} step={s.step} value={s.from(part.value)}
                onChange={(e) => onChange(+s.to(+e.target.value).toPrecision(part.kind === 'R' ? 3 : 4), true)}
              />
              <input
                key={`${part.id}-${part.value}`} dir="ltr" size={10} aria-label={`تایپ مقدار ${part.id}`} defaultValue={+part.value.toPrecision(4)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => { const v = parseValue(e.currentTarget.value); if (v > 0 && v !== part.value) onChange(v, false); }}
              />
              <div className="muted small">با اسلایدر یا تایپ مقدار (مثال: 4.7k ، 10m ، 2u)</div>
            </>
          )}
          {(part.kind === 'C' || part.kind === 'L') && (
            <label className="ic">
              شرط اولیه ({part.kind === 'C' ? 'ولتاژ خازن، V' : 'جریان سلف، A'}){' '}
              <input
                key={`ic-${part.id}-${part.ic ?? 0}`} dir="ltr" size={8} defaultValue={part.ic ?? 0}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => { const v = parseValue(e.currentTarget.value); if (Number.isFinite(v) && v !== (part.ic ?? 0)) onInitial(v); }}
              />
            </label>
          )}
        </>
      )}
    </section>
  );
}

/** تغییرهای وضعیت بازی که Workspace و QuizWorkspace از App می‌خواهند */
export interface Actions {
  success: (id: string, result: LevelResult) => void;
  fail: (id: string) => void;
  hint: (id: string, max: number) => void;
  newRound: (id: string) => void;
}
interface WorkspaceProps {
  /** null یعنی حالت آزاد */
  level: InteractiveLevel | null;
  nextLabel: string;
  onNext: () => void;
  progress: Progress;
  actions: Actions;
}
type Tab = 'results' | 'logic' | 'transient';

export default function Workspace({ level, nextLabel, onNext, progress, actions }: WorkspaceProps) {
  const { state: circuit, set: commit, undo, redo, reset, canUndo, canRedo } = useHistory<Circuit>(level ? level.circuit : SANDBOX);
  const [tool, setTool] = useState<Tool>(defaultTool(level));
  const [pending, setPending] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [solved, setSolved] = useState<ScoreBreakdown | null>(null);
  const [feedback, setFeedback] = useState('');
  const [tab, setTab] = useState<Tab>('results');
  /** مداری که پاسخش ثبت شده؛ تا وقتی مدار عوض نشود نتایجش نمایش داده می‌شود (فقط در مسابقه) */
  const [revealed, setRevealed] = useState<Circuit | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [frozenMs, setFrozenMs] = useState<number | null>(null);

  const locked = useMemo<ReadonlySet<string>>(() => (level ? new Set(level.locked) : NO_LOCK), [level]);
  const analysis = useMemo(() => analyze(circuit), [circuit]);
  const goalResult = useMemo(() => (level ? evaluateGoal(level.goal, circuit) : null), [level, circuit]);
  const selPart = circuit.parts.find((p) => p.id === selected) ?? null;
  const partCount = circuit.parts.filter((p) => p.kind !== 'W').length;
  const run = level ? getRun(progress, level.id) : null;
  const maxAttempts = level ? attemptsFor(level.type) : 0;
  const attemptsLeft = run ? maxAttempts - run.failed : 0;
  /** حالت آزاد: نتایج زنده. حالت مسابقه: فقط بعد از ثبت پاسخ و تا اولین تغییر مدار */
  const showResults = !level || revealed === circuit;
  const hasReactive = circuit.parts.some((p) => p.kind === 'C' || p.kind === 'L');

  /** ثبت پاسخ: فقط اینجا تلاش مصرف می‌شود (ارزیابی زنده تلاش حساب نمی‌شود). */
  const submit = () => {
    if (!level || !run || !goalResult || !goalResult.ok || attemptsLeft <= 0 || solved) return;
    setRevealed(circuit);
    if (goalResult.met) {
      const elapsedMs = Date.now() - startedAt;
      const breakdown = computeScore({
        closeness: goalResult.closeness, partCount, maxParts: level.maxParts,
        hintsUsed: run.hints, failedAttempts: run.failed, rounds: run.rounds,
        elapsedSec: elapsedMs / 1000, parSec: parSeconds(level), engineParts: level.engineParts, difficulty: level.difficulty,
      });
      setFrozenMs(elapsedMs);
      setSolved(breakdown);
      setFeedback('');
      actions.success(level.id, { score: breakdown.total, stars: breakdown.stars });
    } else {
      actions.fail(level.id);
      setFeedback(feedbackFor(goalResult));
    }
  };

  const clearTransient = () => { setPending(null); setSelected(null); setNotice(''); };
  /** «مدار اولیه»: فقط مدار برمی‌گردد؛ زمان‌سنج، تلاش‌ها و راهنماها دست‌نخورده می‌مانند */
  const resetCircuit = () => {
    reset(level ? level.circuit : SANDBOX);
    setRevealed(null);
    setFeedback('');
    clearTransient();
  };
  /** شروع تازه‌ی مرحله (بازی دوباره یا دور جدید): زمان‌سنج هم از نو شروع می‌شود */
  const restartRun = () => {
    resetCircuit();
    setSolved(null);
    setStartedAt(Date.now());
    setFrozenMs(null);
  };
  const newRound = () => {
    if (level) actions.newRound(level.id);
    restartRun();
  };
  const chooseTool = (t: Tool) => { setTool(t); setPending(null); setNotice(''); };
  const deleteSelected = () => {
    if (!selected) return;
    if (locked.has(selected)) { setNotice('این قطعه در این مرحله قفل است.'); return; }
    commit((c) => removePart(c, selected));
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) redo(); else undo();
      } else if (e.key === 'Escape') setPending(null);
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = ALL_TOOLS.find((x) => x.key.toLowerCase() === k);
        if (t && !toolState(t.id).disabled) chooseTool(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** وضعیت ابزار قطعه بر اساس محدودیت‌های مرحله (limits) */
  function toolState(t: Tool): { disabled: boolean; badge?: string } {
    if (!level?.limits || (t !== 'R' && t !== 'V' && t !== 'I' && t !== 'C' && t !== 'L')) return { disabled: false };
    const limit = level.limits[t];
    if (limit === undefined) return { disabled: true };
    return { disabled: false, badge: `${circuit.parts.filter((p) => p.kind === t).length}/${limit}` };
  }

  const handlePoint = (p: Point, partId: string | null) => {
    setNotice('');
    if (tool === 'X') {
      if (partId) {
        if (locked.has(partId)) { setNotice('این قطعه در این مرحله قفل است.'); return; }
        commit((c) => removePart(c, partId));
        setSelected(null);
      } else if (circuit.ground && samePoint(circuit.ground, p)) commit((c) => ({ ...c, ground: null }));
      return;
    }
    if (tool === 'S') {
      const part = circuit.parts.find((x) => x.id === partId);
      setSelected(part && part.kind !== 'W' ? part.id : null);
      return;
    }
    if (tool === 'G') { commit((c) => ({ ...c, ground: p })); return; }
    if (!pending) { setPending(p); return; }
    if (samePoint(pending, p)) { setPending(null); return; }
    if (tool !== 'W' && level?.limits) {
      const limit = level.limits[tool];
      if (limit === undefined) { setNotice('این قطعه در این مرحله مجاز نیست.'); setPending(null); return; }
      if (circuit.parts.filter((x) => x.kind === tool).length >= limit) { setNotice(`حداکثر ${limit} قطعه از این نوع مجاز است.`); setPending(null); return; }
    }
    const fixed = level?.fixedValues?.[tool];
    commit((c) => addPart(c, tool, pending, p, fixed));
    setPending(null);
  };

  const status =
    notice ||
    (tool === 'S' ? 'روی یک قطعه کلیک کن تا مقدارش را تنظیم کنی.'
      : tool === 'X' ? 'روی قطعه یا زمین کلیک کن تا حذف شود.'
      : tool === 'G' ? 'روی نقطه‌ای از مدار کلیک کن تا زمین (۰ ولت) شود.'
      : pending ? 'نقطه دوم را انتخاب کن (Esc برای لغو).'
      : 'نقطه اول را انتخاب کن.');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'results', label: 'نتایج' },
    { id: 'logic', label: 'منطق محاسبه' },
    ...(hasReactive ? [{ id: 'transient' as const, label: 'نمودار گذرا' }] : []),
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'results';
  const fixedKind = selPart ? level?.fixedValues?.[selPart.kind] !== undefined : false;

  return (
    <div className="page work">
      <div className="page-head">
        <nav className="crumbs" aria-label="مسیر">
          {level ? <><a href={href.roadmap}>نقشه مراحل</a><span aria-hidden="true">›</span><span>{level.world}</span></> : <a href={href.home}>خانه</a>}
        </nav>
        <h1>{level ? level.title : 'حالت آزاد'}</h1>
        {level ? <><TypeBadge type={level.type} /><Difficulty level={level.difficulty ?? 1} /></> : <span className="chip">Sandbox</span>}
      </div>
      <div className="workgrid">
        <div className="col">
          {level && run && goalResult && (
            <>
              <LessonCard lesson={level.lesson} open={!progress.results[level.id]} />
              <GoalCard
                level={level} result={goalResult} maxAttempts={maxAttempts} attemptsLeft={attemptsLeft} rounds={run.rounds} hintsUsed={run.hints}
                partCount={partCount} timer={<LevelTimer startedAt={startedAt} frozenMs={frozenMs} parSec={parSeconds(level)} />}
                best={progress.results[level.id]} solved={solved} feedback={feedback} nextLabel={nextLabel}
                onSubmit={submit} onHint={() => actions.hint(level.id, level.hints.length)}
                onResetCircuit={resetCircuit} onReplay={restartRun} onNewRound={newRound} onNext={onNext}
              />
            </>
          )}
          <section className="card board-card">
            <div className="toolbar" role="toolbar" aria-label="ابزارها">
              {TOOL_GROUPS.map((g) => (
                <div className="group" role="group" aria-label={g.label} key={g.label}>
                  {g.tools.map((t) => {
                    const st = toolState(t.id);
                    return (
                      <button
                        key={t.id} className="tool" aria-pressed={tool === t.id} disabled={st.disabled}
                        title={st.disabled ? 'در این مرحله مجاز نیست' : `${t.label} (${t.key})`} onClick={() => chooseTool(t.id)}
                      >
                        <ToolIcon tool={t.id} />
                        <span>{t.label}</span>
                        {st.badge && <small className="count">{st.badge}</small>}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="group" role="group" aria-label="تاریخچه">
                <button className="tool" onClick={undo} disabled={!canUndo} title="بازگردانی (Ctrl+Z)"><span className="glyph-btn">↶</span><span>بازگرد</span></button>
                <button className="tool" onClick={redo} disabled={!canRedo} title="تکرار (Ctrl+Y)"><span className="glyph-btn">↷</span><span>تکرار</span></button>
                {!level && <button className="tool" onClick={() => { commit({ parts: [], ground: null }); clearTransient(); }}><span className="glyph-btn">⌫</span><span>پاک‌کردن</span></button>}
              </div>
            </div>
            <Board
              circuit={circuit} solution={analysis.ok && showResults ? analysis.solution : null} labels={analysis.ok && showResults ? analysis.labels : []}
              pending={pending} hover={hover} selected={selected} tool={tool} goal={level?.goal ?? null} slots={level?.slots} locked={locked}
              onPoint={handlePoint} onHover={setHover}
            />
            {!analysis.ok && <p className="alert" role="alert">{analysis.message}</p>}
            <p className="status" role="status">{status}</p>
          </section>
        </div>
        <aside>
          {selPart && (
            <Inspector
              part={selPart} locked={locked.has(selPart.id) || fixedKind} typed={!!level}
              onChange={(v, merge) => commit((c) => setValue(c, selPart.id, v), merge ? `v:${selPart.id}` : null)}
              onInitial={(v) => commit((c) => setInitial(c, selPart.id, v))}
            />
          )}
          {!showResults ? (
            <section className="card">
              <h2>نتایج بعد از ثبت پاسخ</h2>
              <p className="muted">در حالت مسابقه نتیجه‌ی مدار زنده نمایش داده نمی‌شود. مقدار را محاسبه کن، تنظیم کن و «ثبت پاسخ» را بزن؛ بعد از ثبت، اندازه‌گیری‌ها و مراحل حل نشان داده می‌شوند.</p>
            </section>
          ) : (
            <>
              <div className="tabbar" role="tablist" aria-label="بخش‌های تحلیل">
                {tabs.map((t) => (
                  <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>
              {activeTab === 'transient' ? (
                <TransientPanel circuit={circuit} goal={level?.goal ?? null} />
              ) : (
                <section className="card" role="tabpanel">
                  {activeTab === 'results' ? (
                    analysis.ok ? (
                      <table>
                        <thead><tr><th>قطعه</th><th>مقدار</th><th>ولتاژ</th><th>جریان</th><th>توان</th></tr></thead>
                        <tbody>
                          {circuit.parts.filter((p) => p.kind !== 'W').map((p) => {
                            const r = analysis.solution.elements[p.id];
                            return (
                              <tr key={p.id}>
                                <td>{p.id}</td><td>{formatValue(p.value, UNIT[p.kind])}</td>
                                <td>{formatValue(Math.abs(r.voltage), 'V')}</td><td>{formatValue(Math.abs(r.current), 'A')}</td><td>{formatValue(r.power, 'W')}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="muted">تا کامل‌شدن مدار، نتیجه‌ای برای نمایش نیست.</p>
                    )
                  ) : analysis.ok ? (
                    analysis.steps.map((s) => <div key={s.title}><b>{s.title}</b><pre>{s.lines.join('\n')}</pre></div>)
                  ) : (
                    <p className="muted">مدار را کامل کن تا مراحل محاسبه نمایش داده شود.</p>
                  )}
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
