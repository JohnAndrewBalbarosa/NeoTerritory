import { useEffect, useState } from 'react';
import { fetchAdminOverview, fetchAdminLearningRaw } from '../../api/client';
import type { AdminOverview, AdminLearningRaw } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

// Project Manager Overview. Shows REAL server-recorded operational data where an
// authoritative admin endpoint exists, and TRUTHFUL "not yet available" states
// where the data is not exposed to the dashboard API (formal pre/post-test
// attempts and learning plans are currently self-scoped only — see the PM audit).
// No value is fabricated and no missing metric is shown as 0.

type CardState =
  | { kind: 'value'; value: string; sub?: string }
  | { kind: 'empty'; reason: string };

function StatCard({ title, state }: { title: string; state: CardState }): JSX.Element {
  return (
    <div className={`admin-overview-card${state.kind === 'empty' ? ' admin-overview-card--empty' : ''}`}>
      <p className="admin-overview-card__title">{title}</p>
      {state.kind === 'value' ? (
        <>
          <p className="admin-overview-card__value">{state.value}</p>
          {state.sub ? <p className="admin-overview-card__sub">{state.sub}</p> : null}
        </>
      ) : (
        <p className="admin-overview-card__empty">{state.reason}</p>
      )}
    </div>
  );
}

// Metrics that require per-learner formal-assessment + learning-plan data which
// no admin endpoint currently exposes. Rendered as truthful unavailable states
// (NOT zero) until a read-only PM aggregation endpoint is added.
const PLAN_DEPENDENT_NOTE = 'Not yet available — learning plans and formal pre/post-test results are not exposed to the dashboard API yet.';

export default function OverviewTab(): JSX.Element {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [raw, setRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchAdminOverview(), fetchAdminLearningRaw()]).then(([ov, lr]) => {
      if (!alive) return;
      if (ov.status === 'fulfilled') setOverview(ov.value);
      else if (!isAuthError(ov.reason)) setError('Could not load overview stats.');
      if (lr.status === 'fulfilled') setRaw(lr.value);
    });
    return () => { alive = false; };
  }, []);

  const learners = raw ? raw.students.length : null;

  return (
    <section className="admin-section admin-section--card" aria-label="Project manager overview">
      <header className="admin-section__head">
        <h2>Overview</h2>
        <p className="admin-section__hint">
          Operational snapshot of accounts, in-module learning activity, and C++ analysis. Cards backed by
          unavailable data show a truthful status rather than a fabricated value.
        </p>
      </header>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      <div className="admin-overview-grid">
        {/* REAL operational data (admin endpoints) */}
        <StatCard title="Registered accounts" state={overview ? { kind: 'value', value: String(overview.totalUsers), sub: 'users in the system' } : { kind: 'empty', reason: 'Loading…' }} />
        <StatCard title="Interns with recorded learning activity" state={learners == null ? { kind: 'empty', reason: 'Loading…' } : learners === 0 ? { kind: 'empty', reason: 'No intern has recorded in-module activity yet.' } : { kind: 'value', value: String(learners), sub: 'have in-module records' }} />
        <StatCard title="C++ analysis runs (total)" state={overview ? { kind: 'value', value: String(overview.totalRuns), sub: `${overview.runsToday} today` } : { kind: 'empty', reason: 'Loading…' }} />
        <StatCard title="Avg findings per run" state={overview ? { kind: 'value', value: overview.avgFindings.toFixed(1) } : { kind: 'empty', reason: 'Loading…' }} />

        {/* Workflow cards that depend on plan / formal-assessment data not yet exposed to admin */}
        <StatCard title="Active learning plans" state={{ kind: 'empty', reason: PLAN_DEPENDENT_NOTE }} />
        <StatCard title="Interns awaiting pre-test" state={{ kind: 'empty', reason: PLAN_DEPENDENT_NOTE }} />
        <StatCard title="Interns ready for post-test" state={{ kind: 'empty', reason: PLAN_DEPENDENT_NOTE }} />
        <StatCard title="Completed learning cycles" state={{ kind: 'empty', reason: PLAN_DEPENDENT_NOTE }} />
        <StatCard title="Interns requiring review" state={{ kind: 'empty', reason: PLAN_DEPENDENT_NOTE }} />
      </div>

      <p className="admin-section__hint" style={{ marginTop: '0.75rem' }}>
        All assessment scores are computed and stored by the server and shown read-only here — the dashboard
        provides no way to enter, edit, override, or recalculate a learner&rsquo;s score.
      </p>
    </section>
  );
}
