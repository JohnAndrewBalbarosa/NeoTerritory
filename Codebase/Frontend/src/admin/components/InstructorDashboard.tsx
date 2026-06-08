import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningRaw } from '../../api/client';
import type { AdminLearningRaw } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';
import InstructorStudents from './InstructorStudents';
import InstructorModules from './InstructorModules';
import InstructorKpis from './InstructorKpis';
import LearningAnalytics from './LearningAnalytics';
import { PieChart, type PieSlice } from './StatsCharts';

// DevCon accents for the pass/fail donut. Pass = lime (success), fail = a warm
// coral. Literals (not vars) because PieChart paints SVG fills inline; the
// surrounding .chart-panel still themes its frame from tokens.
const DEVCON_PASS = '#a6ff00';
const DEVCON_FAIL = '#ff5c7a';

// Pass vs fail donut for the dashboard top, computed client-side from the
// already-fetched raw payload (exam attempts) — no extra request.
function ExamOutcomePie({ raw }: { raw: AdminLearningRaw }): JSX.Element | null {
  const slices = useMemo<PieSlice[]>(() => {
    let passed = 0;
    let failed = 0;
    for (const a of raw.examAttempts) {
      if (a.passed) passed += 1;
      else failed += 1;
    }
    return [
      { label: 'Passed', value: passed, color: DEVCON_PASS },
      { label: 'Failed', value: failed, color: DEVCON_FAIL },
    ];
  }, [raw]);

  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <section className="chart-panel instructor-overview-chart">
      <div className="chart-panel-head">
        <h2>Exam outcomes</h2>
        <span className="badge">{total} attempts</span>
      </div>
      {total === 0 ? (
        <div className="empty-state">No exam attempts recorded yet.</div>
      ) : (
        <PieChart slices={slices} title="Pass vs fail" ariaLabel="Exam pass versus fail donut chart" />
      )}
    </section>
  );
}

// Instructor dashboard container (D91). Fetches the RAW learning payload once on
// mount and hosts three sub-views via a segmented control:
//   • Students  — per-student scores / attempts / pass-fail / improvement.
//   • Modules   — module difficulty ranking (hardest-first, grouped ties).
//   • Questions — the existing per-question heatmap (LearningAnalytics), reused
//                 unchanged; it fetches its own per-question stats.
// Students + Modules aggregate the single raw payload client-side, so they
// share one fetch and never re-hit the API on sub-view switches.

type SubView = 'students' | 'modules' | 'questions';

const SUBVIEWS: ReadonlyArray<{ id: SubView; label: string }> = [
  { id: 'students', label: 'Students' },
  { id: 'modules', label: 'Modules' },
  { id: 'questions', label: 'Questions' },
];

export default function InstructorDashboard({ initialView = 'students' }: { initialView?: SubView }): JSX.Element {
  const [raw, setRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SubView>(initialView);

  // Sync with prop when admin shell tabs change
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminLearningRaw()
      .then((d) => { if (!cancelled) setRaw(d); })
      .catch((e: unknown) => {
        if (cancelled) return;
        // A pre-auth 401 race resolves to an empty dataset rather than a red
        // banner (same pattern as the other admin panels).
        if (isAuthError(e)) { setRaw({ students: [], progress: [], questionResults: [], examAttempts: [] }); return; }
        setError(e instanceof Error ? e.message : 'Failed to load learning data');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="instructor-dashboard instructor-dashboard--nested">
      <nav className="instructor-rail" role="tablist" aria-label="Instructor sub-views">
        {SUBVIEWS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={view === s.id}
            className={`instructor-rail-btn${view === s.id ? ' is-active' : ''}`}
            onClick={() => setView(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="instructor-content">
        {/* KPI row (D92 Track A) — client-side from the already-fetched raw payload. */}
        {raw && view !== 'questions' && <InstructorKpis raw={raw} />}

        {/* Pass/fail donut (D92 Track A) — also derived from the same raw payload. */}
        {raw && view !== 'questions' && <ExamOutcomePie raw={raw} />}

        {/* Students + Modules need the raw payload; Questions is self-fetching. */}
        {view === 'questions' ? (
          <LearningAnalytics />
        ) : error ? (
          <div className="empty-state admin-error" role="alert">{error}</div>
        ) : raw === null ? (
          <div className="empty-state">Loading instructor analytics…</div>
        ) : view === 'students' ? (
          <InstructorStudents raw={raw} />
        ) : (
          <InstructorModules raw={raw} />
        )}
      </div>
    </div>
  );
}
