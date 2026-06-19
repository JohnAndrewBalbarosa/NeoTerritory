import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInternDetail, type AdminInternDetailResponse } from '../../api/client';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import {
  deriveLearnerLearningRecord,
  type RawLearnerRecord,
  type LearnerLearningRecord,
} from '../learning/deriveLearnerLearningRecord';

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const diff = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} pp`);

function adapt(d: AdminInternDetailResponse): RawLearnerRecord {
  const active = d.plans.find((p) => p.status === 'active') ?? null;
  return {
    internId: d.profile.internId, username: d.profile.username, email: d.profile.email,
    attempts: d.attempts, answers: d.answers, progress: d.progress,
    activePlan: active ? { id: active.id, projectSpecification: active.projectSpecification, status: active.status, activatedAt: active.activatedAt } : null,
    planModules: active?.modules ?? [],
  };
}

// Read-only, FROZEN learning-cycle detail. Scoring + recommendations are derived
// for the specific cycleId only (cycle isolation) — never mixed with other
// cycles or current course-plan toggles.
export default function AssessmentCycleDetailTab({ internId, cycleId, onBack }: { internId: number; cycleId: string; onBack: () => void }): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [detail, setDetail] = useState<AdminInternDetailResponse | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchAdminLearningInternDetail(internId)
      .then((res) => { if (alive) { setDetail(res); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        if (isAuthError(e)) setError({ kind: 'auth', message: 'Not authorized, or session expired.' });
        else setError({ kind: 'generic', message: e instanceof Error ? e.message : 'Failed to load cycle.' });
      });
    return () => { alive = false; };
  }, [internId, reloadKey]);

  const rec: LearnerLearningRecord | null = useMemo(() => {
    if (!detail || !loaded) return null;
    return deriveLearnerLearningRecord(adapt(detail), modules, cycleId);
  }, [detail, modules, loaded, cycleId]);

  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const preDate = detail?.attempts.find((a) => a.assessmentType === 'pretest' && a.cycleId === cycleId)?.createdAt?.slice(0, 10) ?? '—';
  const postDate = detail?.attempts.find((a) => a.assessmentType === 'posttest' && a.cycleId === cycleId)?.createdAt?.slice(0, 10) ?? '—';

  return (
    <section className="admin-section admin-section--card" aria-label="Learning cycle detail">
      <header className="admin-section__head">
        <button type="button" className="ghost-btn" onClick={onBack}>← Back to Assessments</button>
        <h2 style={{ marginTop: 8 }}>Learning Cycle <span className="nt-mono">{cycleId.slice(0, 8)}</span></h2>
      </header>

      {loading ? <p className="admin-section__hint" role="status">Loading cycle…</p>
        : error ? <div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div>
        : !rec ? <p className="admin-section__hint">No record.</p>
        : !rec.hasPreTest ? <p className="admin-section__hint">This cycle has no pre-test attempt recorded.</p>
        : (
          <>
            <div className="admin-overview-grid">
              <div className="admin-overview-card"><p className="admin-overview-card__title">Intern</p><p className="admin-overview-card__value">{rec.displayName}</p></div>
              <div className="admin-overview-card"><p className="admin-overview-card__title">Plan</p><p className="admin-overview-card__value nt-mono">{rec.activePlan?.id ?? '—'}</p></div>
              <div className="admin-overview-card"><p className="admin-overview-card__title">Cycle status</p><p className="admin-overview-card__value">{rec.stage}</p></div>
              <div className="admin-overview-card"><p className="admin-overview-card__title">Started</p><p className="admin-overview-card__value">{preDate}</p></div>
              <div className="admin-overview-card"><p className="admin-overview-card__title">Completed</p><p className="admin-overview-card__value">{rec.hasPostTest ? postDate : '—'}</p></div>
            </div>

            <h3 style={{ marginTop: 16 }}>Project-Relevant Modules ({rec.projectRelevantModuleIds.length})</h3>
            <p className="admin-section__hint">Frozen module set included when this cycle began.</p>
            <div className="nt-chips">{rec.recommendations.map((m) => <span key={m.moduleId} className="nt-chip-sm" title={`${m.category} · ${m.recommendation === 'recommended_to_study' ? 'Recommended' : 'Already understood'}`}>{m.moduleTitle}</span>)}</div>

            <h3 style={{ marginTop: 16 }}>Formal Pre-Test</h3>
            <p className="admin-section__hint">Raw {rec.preScore?.correct ?? '—'}/{rec.preScore?.total ?? '—'} · {pct(rec.prePercent)} · submitted {preDate}</p>

            <h3 style={{ marginTop: 16 }}>Module Recommendation Summary</h3>
            <h4 className="nt-muted">Recommended to Study ({rec.recommendedToStudy.length})</h4>
            {rec.recommendedToStudy.length === 0 ? <p className="admin-section__hint">None.</p> : (
              <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Pre-Test</th><th>Reason</th><th>Progress</th><th>Conceptual</th><th>Practical</th></tr></thead>
                <tbody>{rec.recommendedToStudy.map((m) => <tr key={m.moduleId}><td>{m.moduleTitle}</td><td>{pct(m.preTestPercentage)}</td><td className="nt-muted">{m.recommendationReason}</td><td>{m.progressPercent}%</td><td>{m.conceptualStatus}</td><td>{m.practicalStatus}</td></tr>)}</tbody></table></div>
            )}
            <h4 className="nt-muted" style={{ marginTop: 10 }}>Already Understood / Skipped ({rec.alreadyUnderstood.length})</h4>
            {rec.alreadyUnderstood.length === 0 ? <p className="admin-section__hint">None.</p> : (
              <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Pre-Test</th><th>Reason</th></tr></thead>
                <tbody>{rec.alreadyUnderstood.map((m) => <tr key={m.moduleId}><td>{m.moduleTitle}</td><td>{pct(m.preTestPercentage)}</td><td className="nt-muted">{m.recommendationReason}</td></tr>)}</tbody></table></div>
            )}

            <h3 style={{ marginTop: 16 }}>Learning Progress</h3>
            <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Pre-Test</th><th>Recommendation</th><th>Assigned/Skipped</th><th>Progress</th><th>Conceptual</th><th>Practical</th><th>Post-Test</th><th>Final Status</th></tr></thead>
              <tbody>{rec.recommendations.map((m) => <tr key={m.moduleId}><td>{m.moduleTitle}</td><td>{pct(m.preTestPercentage)}</td><td>{m.recommendation === 'recommended_to_study' ? 'Recommended to Study' : 'Already Understood'}</td><td>{m.assigned ? 'Assigned' : 'Skipped'}</td><td>{m.progressPercent}%</td><td>{m.conceptualStatus}</td><td>{m.practicalStatus}</td><td>{pct(m.postTestPercentage)}</td><td>{m.finalStatus}</td></tr>)}</tbody></table></div>

            <h3 style={{ marginTop: 16 }}>Practical Assessment Results</h3>
            {rec.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').length === 0 ? <p className="admin-section__hint">No practical-bearing modules in this cycle.</p> : (
              <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Expected Pattern</th><th>Available Record</th></tr></thead>
                <tbody>{rec.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').map((m) => {
                  const submitted = (detail?.answers ?? []).some((a) => a.moduleId === m.moduleId && a.questionKind === 'practical');
                  return <tr key={m.moduleId}><td>{m.moduleTitle}</td><td className="nt-muted">{moduleById.get(m.moduleId)?.practicalExam?.patternName ?? '—'}</td><td>{m.progressPercent >= 100 ? 'Completed' : submitted ? 'Submitted' : 'Not Submitted'}</td></tr>;
                })}</tbody></table>
              </div>
            )}
            <p className="admin-section__hint">Note: no dedicated documentation-based checking summary or separate practical grade is stored; the record shows completion/submission state only.</p>

            <h3 style={{ marginTop: 16 }}>Formal Post-Test</h3>
            {rec.hasPostTest ? <p className="admin-section__hint">Raw {rec.postScore?.correct ?? '—'}/{rec.postScore?.total ?? '—'} · {pct(rec.postPercent)} · submitted {postDate}</p> : <p className="admin-section__hint">No post-test recorded for this cycle.</p>}

            <h3 style={{ marginTop: 16 }}>Learning Comparison</h3>
            <p className="admin-section__hint">Pre-test {pct(rec.prePercent)} → Post-test {pct(rec.postPercent)} · <strong>{diff(rec.ppDiff)}</strong> (post − pre, same cycle)</p>

            <p className="admin-section__hint" style={{ marginTop: 10 }}><strong>Interpretation:</strong> {rec.interpretation}</p>
            <p className="admin-section__hint"><strong>Suggested PM action:</strong> <span className="nt-badge nt-badge--action">{rec.suggestedAction}</span> <em>(decision support only)</em></p>
          </>
        )}
    </section>
  );
}
