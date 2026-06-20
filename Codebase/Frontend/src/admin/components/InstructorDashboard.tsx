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

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

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

type SubView = 'overview' | 'students' | 'modules' | 'questions';

const SUBVIEWS: ReadonlyArray<{ id: Exclude<SubView, 'overview'>; label: string; description: string }> = [
  {
    id: 'students',
    label: 'Students',
    description: 'Per-intern progress, Practice Improvement (first-try to eventual mastery), and question-level drilldown.',
  },
  {
    id: 'modules',
    label: 'Modules',
    description: 'Hardest-first module ranking (based on first-attempt performance) with difficulty bars and CSV export.',
  },
  {
    id: 'questions',
    label: 'Questions',
    description: 'Module-by-question heatmap and raw intern answer drilldown.',
  },
];

function viewLabel(view: SubView): string {
  if (view === 'overview') return 'Overview';
  return SUBVIEWS.find((item) => item.id === view)?.label ?? 'Overview';
}

export default function InstructorDashboard({ initialView = 'students' }: { initialView?: Exclude<SubView, 'overview'> }): JSX.Element {
  const [raw, setRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SubView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminLearningRaw()
      .then((d) => {
        if (!cancelled) setRaw(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isAuthError(e)) {
          setRaw({ students: [], progress: [], questionResults: [], examAttempts: [] });
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to load learning data');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openView(next: Exclude<SubView, 'overview'>): void {
    setView(next);
  }

  function backToOverview(): void {
    setView('overview');
  }

  const activeLabel = viewLabel(view);

  return (
    <div className="instructor-dashboard instructor-dashboard--folder">
      <header className="instructor-dashboard__head">
        <div className="instructor-breadcrumbs" aria-label="Instructor navigation">
          <span className="instructor-breadcrumbs__root">Instructor</span>
          <span className="instructor-breadcrumbs__sep" aria-hidden="true">/</span>
          <span className="instructor-breadcrumbs__current">{activeLabel}</span>
        </div>
        {view !== 'overview' ? (
          <button type="button" className="ghost-btn instructor-back-btn" onClick={backToOverview}>
            Back to overview
          </button>
        ) : (
          <span className="instructor-dashboard__hint">Choose a folder below to drill into intern learning data.</span>
        )}
      </header>

      {view === 'overview' && raw && <InstructorKpis raw={raw} />}
      {view === 'overview' && raw && <ExamOutcomePie raw={raw} />}

      {view === 'overview' ? (
        error ? (
          <div className="empty-state admin-error" role="alert">{error}</div>
        ) : raw === null ? (
          <div className="empty-state">Loading instructor analytics…</div>
        ) : (
          <section className="instructor-card instructor-launchpad">
            <header className="instructor-card__head">
              <div className="instructor-card__title">
                <h3>Open a folder</h3>
                <span className="instructor-card__count">nested drilldowns</span>
              </div>
              <div className="instructor-card__tools">
                <span className="admin-section__hint">The sidebar stays clean; use the cards below to enter a view.</span>
              </div>
            </header>
            <div className="instructor-launchpad__grid" role="list" aria-label="Instructor folders">
              {SUBVIEWS.map((subview) => (
                <button
                  key={subview.id}
                  type="button"
                  className="instructor-launchcard"
                  onClick={() => openView(subview.id)}
                  role="listitem"
                >
                  <span className="instructor-launchcard__label">{subview.label}</span>
                  <span className="instructor-launchcard__desc">{subview.description}</span>
                </button>
              ))}
            </div>
          </section>
        )
      ) : error ? (
        <div className="empty-state admin-error" role="alert">{error}</div>
      ) : raw === null ? (
        <div className="empty-state">Loading instructor analytics…</div>
      ) : view === 'students' ? (
        <InstructorStudents raw={raw} />
      ) : view === 'modules' ? (
        <InstructorModules raw={raw} />
      ) : (
        <LearningAnalytics />
      )}
    </div>
  );
}
