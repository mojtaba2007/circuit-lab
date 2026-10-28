import { useMemo, useState } from 'react';
import { analyze } from '../editor/analyze';
import { getRun, type Progress } from '../levels/progress';
import { correctCircuit, correctOption, evaluateClaim } from '../levels/quiz';
import { attemptsFor, computeScore, parSeconds, type ScoreBreakdown } from '../levels/scoring';
import type { QuizLevel } from '../levels/types';
import { href } from '../routes';
import { Board } from '../ui/Board';
import { Difficulty, TypeBadge } from '../ui/icons';
import { LessonCard, QuizCard } from '../ui/LevelPanel';
import { LevelTimer } from '../ui/LevelTimer';
import type { Actions } from './Workspace';

const NO_LOCK: ReadonlySet<string> = new Set();
const noop = () => undefined;

interface Props {
  level: QuizLevel;
  nextLabel: string;
  onNext: () => void;
  progress: Progress;
  actions: Actions;
}

/** سؤال‌های درست/نادرست، پیش‌بینی و «کدام مدار؟»: مدارها فقط‌خواندنی‌اند و پاسخ را موتور می‌سنجد. */
export default function QuizWorkspace({ level, nextLabel, onNext, progress, actions }: Props) {
  const [solved, setSolved] = useState<ScoreBreakdown | null>(null);
  const [feedback, setFeedback] = useState('');
  const [wrong, setWrong] = useState<(boolean | number)[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [frozenMs, setFrozenMs] = useState<number | null>(null);

  const analysisA = useMemo(() => analyze(level.circuit), [level]);
  const analysisB = useMemo(() => (level.type === 'choose' ? analyze(level.circuitB) : null), [level]);
  const verdict = useMemo(() => (level.type === 'truefalse' ? evaluateClaim(level.claim, level.circuit) : null), [level]);
  const prediction = useMemo(() => (level.type === 'predict' ? correctOption(level.ask, level.options, level.circuit) : null), [level]);
  const choice = useMemo(() => (level.type === 'choose' ? correctCircuit(level.criterion, level.circuit, level.circuitB) : null), [level]);
  const run = getRun(progress, level.id);
  const maxAttempts = attemptsFor(level.type);
  const attemptsLeft = maxAttempts - run.failed;
  const reveal = !!solved || attemptsLeft <= 0;
  const error =
    (verdict && !verdict.ok ? verdict.message : null) ??
    (prediction && !prediction.ok ? prediction.message : null) ??
    (choice && !choice.ok ? choice.message : null);
  const correctIndex = prediction && prediction.ok ? prediction.index : choice && choice.ok ? choice.index : null;

  const answer = (picked: boolean | number) => {
    if (solved || attemptsLeft <= 0 || error) return;
    const correct = level.type === 'truefalse' ? verdict?.ok === true && picked === verdict.truth : picked === correctIndex;
    if (correct) {
      const elapsedMs = Date.now() - startedAt;
      const breakdown = computeScore({
        closeness: 0, partCount: 0, maxParts: 0, hintsUsed: run.hints, failedAttempts: run.failed, rounds: run.rounds,
        elapsedSec: elapsedMs / 1000, parSec: parSeconds(level), difficulty: level.difficulty,
      });
      setSolved(breakdown);
      setFrozenMs(elapsedMs);
      setFeedback('');
      actions.success(level.id, { score: breakdown.total, stars: breakdown.stars });
    } else {
      actions.fail(level.id);
      setWrong((w) => [...w, picked]);
      setFeedback('پاسخ درست نیست؛ دوباره فکر کن!');
    }
  };
  const newRound = () => {
    actions.newRound(level.id);
    setSolved(null);
    setWrong([]);
    setFeedback('');
    setStartedAt(Date.now());
    setFrozenMs(null);
  };

  const boards = [
    { title: level.type === 'choose' ? 'مدار A' : 'مدار', circuit: level.circuit, analysis: analysisA },
    ...(level.type === 'choose' && analysisB ? [{ title: 'مدار B', circuit: level.circuitB, analysis: analysisB }] : []),
  ];

  return (
    <div className="page work">
      <div className="page-head">
        <nav className="crumbs" aria-label="مسیر"><a href={href.roadmap}>نقشه مراحل</a><span aria-hidden="true">›</span><span>{level.world}</span></nav>
        <h1>{level.title}</h1>
        <TypeBadge type={level.type} />
        <Difficulty level={level.difficulty ?? 1} />
      </div>
      <div className="workgrid quiz-grid">
        <div className="col">
          {boards.map((b) => (
            <section className="card board-card" key={b.title}>
              <h2>{b.title}</h2>
              <Board
                circuit={b.circuit} solution={reveal && b.analysis.ok ? b.analysis.solution : null} labels={reveal && b.analysis.ok ? b.analysis.labels : []}
                pending={null} hover={null} selected={null} tool="S" goal={null} locked={NO_LOCK} readOnly onPoint={noop} onHover={noop}
              />
              <p className="status">{reveal ? 'اندازه‌گیری‌های واقعی مدار نمایش داده شد.' : 'مدار فقط‌خواندنی است؛ مقدار قطعه‌ها را ببین و با محاسبه تصمیم بگیر.'}</p>
            </section>
          ))}
        </div>
        <aside>
          <LessonCard lesson={level.lesson} open={!progress.results[level.id]} />
          <QuizCard
            level={level} maxAttempts={maxAttempts} attemptsLeft={attemptsLeft} rounds={run.rounds} hintsUsed={run.hints}
            timer={<LevelTimer startedAt={startedAt} frozenMs={frozenMs} parSec={parSeconds(level)} />}
            best={progress.results[level.id]} solved={solved} feedback={feedback} wrong={wrong}
            truth={verdict && verdict.ok ? verdict.truth : null} correctIndex={correctIndex}
            error={error} nextLabel={nextLabel} onAnswer={answer} onHint={() => actions.hint(level.id, level.hints.length)}
            onNewRound={newRound} onNext={onNext}
          />
        </aside>
      </div>
    </div>
  );
}
