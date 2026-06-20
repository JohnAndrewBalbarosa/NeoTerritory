import { useMemo } from 'react';
import type { AdminLearningRaw } from '../../types/api';
import { moduleDifficulty } from '../logic/learningAggregate';

// KPI stat-card row for the Instructor dashboard (D92 Track A). Computed
// client-side from the single raw payload the dashboard already fetched — no
// extra request. Reuses the admin `stat-card` grid; DevCon-tinted via the
// existing color variants (cyan / green / accent / amber).

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

interface InstructorKpisProps {
  raw: AdminLearningRaw;
}

export default function InstructorKpis({ raw }: InstructorKpisProps): JSX.Element {
  const k = useMemo(() => {
    const learners = raw.students.length;
    const qr = raw.questionResults;
    const seen = qr.length;
    const firstTry = qr.reduce((n, q) => n + (q.firstAttemptCorrect ? 1 : 0), 0);
    const firstTryRate = seen > 0 ? firstTry / seen : 0;
    const attempts = raw.examAttempts;
    const passed = attempts.reduce((n, a) => n + (a.passed ? 1 : 0), 0);
    const passRate = attempts.length > 0 ? passed / attempts.length : 0;
    const completedTotal = raw.progress.reduce((n, p) => n + p.completedModuleIds.length, 0);
    const avgCompleted = learners > 0 ? completedTotal / learners : 0;
    const hardest = moduleDifficulty(raw)[0];
    return { learners, firstTryRate, examAttempts: attempts.length, passRate, avgCompleted, hardest };
  }, [raw]);

  return (
    <div className="instructor-kpis admin-stats" aria-label="Instructor key metrics">
      <div className="stat-card cyan">
        <span className="stat-label">Interns</span>
        <strong className="stat-value">{k.learners}</strong>
        <span className="stat-sub">with recorded activity</span>
      </div>
      <div className="stat-card green">
        <span className="stat-label">Avg first-try rate</span>
        <strong className="stat-value">{pct(k.firstTryRate)}</strong>
        <span className="stat-sub">across all answered questions</span>
      </div>
      <div className="stat-card accent">
        <span className="stat-label">Exam attempts</span>
        <strong className="stat-value">{k.examAttempts}</strong>
        <span className="stat-sub">{pct(k.passRate)} passed</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Avg modules done</span>
        <strong className="stat-value">{k.avgCompleted.toFixed(1)}</strong>
        <span className="stat-sub">completed per intern</span>
      </div>
      <div className="stat-card amber">
        <span className="stat-label">Hardest module</span>
        <strong className="stat-value instructor-kpi__title">{k.hardest ? k.hardest.title : '—'}</strong>
        <span className="stat-sub">
          {k.hardest ? `${pct(k.hardest.firstTryPassRate)} first-try · ${k.hardest.seen} seen` : 'no data yet'}
        </span>
      </div>
    </div>
  );
}
