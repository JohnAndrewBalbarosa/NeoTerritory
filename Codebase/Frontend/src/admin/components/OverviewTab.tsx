import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInterns, fetchAdminLearningRaw } from '../../api/client';
import type { AdminLearningRaw } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import {
  deriveLearnerLearningRecord,
  listLearnerCycles,
  type RawLearnerRecord,
  type LearnerLearningRecord,
} from '../learning/deriveLearnerLearningRecord';
import { summarizeOverview, ALL_STAGES } from '../learning/summarizeOverview';

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const diff = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} pp`);

function Card({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="admin-overview-card">
      <p className="admin-overview-card__title">{label}</p>
      <p className="admin-overview-card__value">{value}</p>
      {sub ? <p className="admin-overview-card__sub">{sub}</p> : null}
    </div>
  );
}

// SOP-1 PM Overview: a learning-focused operational dashboard derived entirely
// from the implemented PM learning records (no registered-account / C++-run /
// infrastructure cards as the focus). Stage counts, recommendations, and cycle
// completion come from the shared derivation helpers over GET /interns; conceptual
// attempt totals come from the stored in-module question results (learning-raw).
export default function OverviewTab({ onOpenIntern, onManageCoursePlan }: { onOpenIntern: (id: number) => void; onManageCoursePlan: () => void }): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [raw, setRaw] = useState<RawLearnerRecord[] | null>(null);
  const [learningRaw, setLearningRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.allSettled([fetchAdminLearningInterns(), fetchAdminLearningRaw()]).then(([interns, lr]) => {
      if (!alive) return;
      setLoading(false);
      if (interns.status === 'fulfilled') setRaw(interns.value.interns);
      else if (isAuthError(interns.reason)) setError({ kind: 'auth', message: 'Not authorized, or your session expired.' });
      else setError({ kind: 'generic', message: interns.reason instanceof Error ? interns.reason.message : 'Failed to load learning records.' });
      if (lr.status === 'fulfilled') setLearningRaw(lr.value);
    });
    return () => { alive = false; };
  }, [reloadKey]);

  // Per-intern (latest cycle) + every cycle, derived with the shared helper.
  const records: LearnerLearningRecord[] = useMemo(() => (raw && loaded ? raw.map((r) => deriveLearnerLearningRecord(r, modules)) : []), [raw, modules, loaded]);
  const cycleRecords: LearnerLearningRecord[] = useMemo(() => {
    if (!raw || !loaded) return [];
    return raw.flatMap((r) => listLearnerCycles(r).map((cid) => deriveLearnerLearningRecord(r, modules, cid)));
  }, [raw, modules, loaded]);

  // Conceptual attempts (in-module question results — NOT formal pre/post). Sum
  // of stored `attempts`. Repeated-attempt interns = any module attempts > 1.
  const conceptual = useMemo(() => {
    const totalByIntern = new Map<number, number>();
    const repeated = new Set<number>();
    let total = 0;
    for (const q of learningRaw?.questionResults ?? []) {
      total += q.attempts;
      totalByIntern.set(q.userId, (totalByIntern.get(q.userId) ?? 0) + q.attempts);
      if (q.attempts > 1) repeated.add(q.userId);
    }
    return { total, totalByIntern, repeated, available: learningRaw !== null };
  }, [learningRaw]);

  // Practical submissions = stored practical answers (questionKind === 'practical').
  const practical = useMemo(() => {
    const byIntern = new Map<number, number>();
    let total = 0;
    for (const r of raw ?? []) {
      const subs = new Set(r.answers.filter((a) => a.questionKind === 'practical').map((a) => a.moduleId));
      byIntern.set(r.internId, subs.size);
      total += subs.size;
    }
    return { total, byIntern };
  }, [raw]);

  const summary = useMemo(() => summarizeOverview(records, cycleRecords, conceptual.repeated), [records, cycleRecords, conceptual.repeated]);
  const activePlans = useMemo(() => records.filter((r) => r.activePlan).map((r) => ({ r, plan: r.activePlan! })), [records]);

  if (loading) return <section className="admin-section admin-section--card"><p className="admin-section__hint" role="status">Loading learning dashboard…</p></section>;
  if (error) return <section className="admin-section admin-section--card"><div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div></section>;

  return (
    <>
      <section className="admin-section admin-section--card" aria-label="Project manager learning overview">
        <header className="admin-section__head">
          <h2>Learning Overview</h2>
          <p className="admin-section__hint">Intern learning progress and assessment activity across the project-based learning workflow.</p>
        </header>
        <div className="admin-overview-grid">
          <Card label="Active Interns" value={String(summary.activeInterns)} />
          <Card label="Awaiting Pre-Test" value={String(summary.awaitingPreTest)} />
          <Card label="Learning in Progress" value={String(summary.learningInProgress)} />
          <Card label="Ready for Post-Test" value={String(summary.readyForPostTest)} />
          <Card label="Needs Review" value={String(summary.needsReview)} />
          <Card label="Completed Learning Cycles" value={String(summary.completedLearningCycles)} sub="cycles with a paired post-test" />
          <Card label="Avg Recommended Modules / Intern" value={summary.activeInterns ? summary.avgRecommendedPerIntern.toFixed(1) : '—'} />
          <Card label="Avg Recommended-Module Completion" value={summary.avgRecommendedCompletionPct === null ? '—' : `${summary.avgRecommendedCompletionPct}%`} sub="recommended modules only" />
          <Card label="Total Conceptual Attempts" value={conceptual.available ? String(conceptual.total) : '—'} sub={conceptual.available ? 'in-module question attempts' : 'unavailable'} />
          <Card label="Total Practical Submissions" value={String(practical.total)} sub="stored practical submissions (not a formal grade)" />
        </div>
      </section>

      {/* Active course plans — learner-level (no single global plan). */}
      <section className="admin-section admin-section--card" aria-label="Active course plans">
        <header className="admin-section__head admin-section__head--action">
          <div><h2>Active Course Plans</h2><p className="admin-section__hint">Intern-level active plans, with one plan per intern.</p></div>
          <button type="button" className="ghost-btn" onClick={onManageCoursePlan}>Manage Course Plan</button>
        </header>
        {activePlans.length === 0 ? <p className="admin-section__hint">No active intern plans yet.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table">
            <thead><tr><th>Intern</th><th>Plan</th><th>Project Spec</th><th>Project-Relevant Modules</th><th>Status</th><th>Activated</th></tr></thead>
            <tbody>{activePlans.slice(0, 12).map(({ r, plan }) => (
              <tr key={r.internId}><td>{r.displayName}</td><td className="nt-mono nt-muted">{plan.id}</td><td className="nt-muted">{plan.projectSpecification ? `${plan.projectSpecification.slice(0, 60)}${plan.projectSpecification.length > 60 ? '…' : ''}` : '—'}</td><td>{r.projectRelevantModuleIds.length}<div className="nt-chips">{r.recommendations.slice(0, 3).map((m) => <span key={m.moduleId} className="nt-chip-sm">{m.moduleTitle}</span>)}{r.recommendations.length > 3 ? <span className="nt-chip-sm">+{r.recommendations.length - 3}</span> : null}</div></td><td>{plan.status}</td><td className="nt-muted">{plan.activatedAt?.slice(0, 10) ?? '—'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {/* Learning-stage distribution */}
      <section className="admin-section admin-section--card" aria-label="Learning stage distribution">
        <header className="admin-section__head"><h2>Learning-Stage Distribution</h2></header>
        <div className="nt-records-filters">
          {ALL_STAGES.map((s) => <span key={s} className="nt-badge" data-stage={s}>{s}: {summary.stageCounts[s]}</span>)}
        </div>
      </section>

      {/* Intern learning progress table */}
      <section className="admin-section admin-section--card" aria-label="Intern learning progress">
        <header className="admin-section__head"><h2>Intern Learning Progress</h2></header>
        {records.length === 0 ? <p className="admin-section__hint">No intern learning records yet.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table">
            <thead><tr><th>Intern</th><th>Stage</th><th>Pre-Test</th><th>Project-Relevant</th><th>Rec. to Study</th><th>Completed Rec.</th><th>Conceptual Attempts</th><th>Practical Submissions</th><th>Post-Test</th><th>Score Diff</th><th>Suggested PM Action</th><th></th></tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.internId}>
                <td><strong>{r.displayName}</strong></td>
                <td><span className="nt-badge" data-stage={r.stage}>{r.stage}</span></td>
                <td>{pct(r.prePercent)}</td>
                <td>{r.projectRelevantModuleIds.length}</td>
                <td>{r.recommendedToStudy.length}{r.recommendedToStudy.length ? <div className="nt-chips">{r.recommendedToStudy.slice(0, 2).map((m) => <span key={m.moduleId} className="nt-chip-sm" title={m.moduleTitle}>{m.moduleTitle}</span>)}{r.recommendedToStudy.length > 2 ? <span className="nt-chip-sm">+{r.recommendedToStudy.length - 2}</span> : null}</div> : null}</td>
                <td>{r.completedRecommendedCount} / {r.recommendedToStudy.length}</td>
                <td>{conceptual.available ? (conceptual.totalByIntern.get(r.internId) ?? 0) : '—'}</td>
                <td>{practical.byIntern.get(r.internId) ?? 0}</td>
                <td>{pct(r.postPercent)}</td>
                <td>{diff(r.ppDiff)}</td>
                <td><span className="nt-badge nt-badge--action">{r.suggestedAction}</span></td>
                <td><button type="button" className="ghost-btn" onClick={() => onOpenIntern(r.internId)}>View Details</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {/* Intern module recommendation summary */}
      <section className="admin-section admin-section--card" aria-label="Intern module recommendations">
        <header className="admin-section__head"><h2>Intern Module Recommendations</h2></header>
        {records.length === 0 ? <p className="admin-section__hint">No records.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table">
            <thead><tr><th>Intern</th><th>Project-Relevant</th><th>Recommended to Study</th><th>Already Understood</th><th>Completed Rec.</th><th>Progress</th><th>Stage</th><th></th></tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.internId}>
                <td>{r.displayName}</td>
                <td>{r.projectRelevantModuleIds.length}</td>
                <td><div className="nt-chips">{r.recommendedToStudy.length === 0 ? <span className="nt-muted">none</span> : r.recommendedToStudy.map((m) => <span key={m.moduleId} className="nt-chip-sm">{m.moduleTitle}</span>)}</div></td>
                <td><div className="nt-chips">{r.alreadyUnderstood.length === 0 ? <span className="nt-muted">none</span> : r.alreadyUnderstood.map((m) => <span key={m.moduleId} className="nt-chip-sm">{m.moduleTitle}</span>)}</div></td>
                <td>{r.completedRecommendedCount} / {r.recommendedToStudy.length}</td>
                <td>{r.recommendedToStudy.length ? `${Math.round((r.completedRecommendedCount / r.recommendedToStudy.length) * 100)}%` : '—'}</td>
                <td><span className="nt-badge" data-stage={r.stage}>{r.stage}</span></td>
                <td><button type="button" className="ghost-btn" onClick={() => onOpenIntern(r.internId)}>View</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {/* Needs attention */}
      <section className="admin-section admin-section--card" aria-label="Needs attention">
        <header className="admin-section__head"><h2>Needs Attention</h2></header>
        {summary.needsAttention.length === 0 ? <p className="admin-section__hint">Nothing needs attention right now.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table">
            <thead><tr><th>Intern</th><th>Issue</th><th>Module</th><th>Stage</th><th></th></tr></thead>
            <tbody>{summary.needsAttention.map((n, i) => (
              <tr key={`${n.internId}-${i}`}><td>{n.displayName}</td><td>{n.issue}</td><td className="nt-muted">{n.moduleTitle ?? '—'}</td><td><span className="nt-badge" data-stage={n.stage}>{n.stage}</span></td><td><button type="button" className="ghost-btn" onClick={() => onOpenIntern(n.internId)}>Open</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
