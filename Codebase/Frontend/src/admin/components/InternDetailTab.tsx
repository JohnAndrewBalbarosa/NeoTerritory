import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInternDetail, type AdminInternDetailResponse } from '../../api/client';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import {
  deriveLearnerLearningRecord,
  type RawLearnerRecord,
  type LearnerLearningRecord,
  type LearnerModuleRecommendation,
} from '../learning/deriveLearnerLearningRecord';

type SubTab = 'summary' | 'path' | 'assessments' | 'practical';
const SUB_TABS: Array<{ id: SubTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'path', label: 'Learning Path' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'practical', label: 'Practical Tasks' },
];

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const diff = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} pp`);

function adaptToRecord(d: AdminInternDetailResponse): RawLearnerRecord {
  const active = d.plans.find((p) => p.status === 'active') ?? null;
  return {
    internId: d.profile.internId,
    username: d.profile.username,
    email: d.profile.email,
    attempts: d.attempts,
    answers: d.answers,
    progress: d.progress,
    activePlan: active ? { id: active.id, projectSpecification: active.projectSpecification, status: active.status, activatedAt: active.activatedAt } : null,
    planModules: active?.modules ?? [],
  };
}

function Card({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="admin-overview-card"><p className="admin-overview-card__title">{label}</p><p className="admin-overview-card__value">{value}</p></div>
  );
}

function RecRow({ m }: { m: LearnerModuleRecommendation }): JSX.Element {
  return (
    <tr>
      <td><strong>{m.moduleTitle}</strong></td>
      <td className="nt-muted">{m.category}</td>
      <td>{pct(m.preTestPercentage)}</td>
      <td><span className="nt-badge" data-stage={m.recommendation === 'recommended_to_study' ? 'Learning in Progress' : 'Post-Test Completed'}>{m.recommendation === 'recommended_to_study' ? 'Recommended to Study' : 'Already Understood'}</span></td>
      <td className="nt-muted">{m.recommendationReason}</td>
      <td>{m.assigned ? 'Assigned' : 'Skipped'}</td>
      <td>{m.progressPercent}%</td>
      <td>{m.conceptualStatus}</td>
      <td>{m.practicalStatus}</td>
      <td>{pct(m.postTestPercentage)}</td>
      <td>{m.finalStatus}</td>
    </tr>
  );
}

export default function InternDetailTab({ internId, onBack }: { internId: number; onBack: () => void }): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [detail, setDetail] = useState<AdminInternDetailResponse | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [sub, setSub] = useState<SubTab>('summary');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchAdminLearningInternDetail(internId)
      .then((res) => { if (alive) { setDetail(res); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        if (isAuthError(e)) setError({ kind: 'auth', message: 'Not authorized, or your session expired.' });
        else setError({ kind: 'generic', message: e instanceof Error ? e.message : 'Failed to load intern.' });
      });
    return () => { alive = false; };
  }, [internId, reloadKey]);

  const rec: LearnerLearningRecord | null = useMemo(() => {
    if (!detail || !loaded) return null;
    return deriveLearnerLearningRecord(adaptToRecord(detail), modules);
  }, [detail, modules, loaded]);

  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const preAttempt = detail && rec?.cycleId ? detail.attempts.find((a) => a.assessmentType === 'pretest' && a.cycleId === rec.cycleId) : undefined;
  const postAttempt = detail && rec?.cycleId ? detail.attempts.find((a) => a.assessmentType === 'posttest' && a.cycleId === rec.cycleId) : undefined;

  return (
    <section className="admin-section admin-section--card" aria-label="Intern detail">
      <header className="admin-section__head" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div>
          <button type="button" className="ghost-btn" onClick={onBack}>← Back to Intern Records</button>
          <h2 style={{ marginTop: 8 }}>{rec ? rec.displayName : `Intern #${internId}`}</h2>
        </div>
      </header>

      {loading ? (
        <p className="admin-section__hint" role="status">Loading intern…</p>
      ) : error ? (
        <div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div>
      ) : !rec ? (
        <p className="admin-section__hint">No record.</p>
      ) : (
        <>
          <div className="nt-records-filters" role="tablist" aria-label="Intern detail sections" style={{ marginBottom: 14 }}>
            {SUB_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={sub === t.id} className={`nt-chip${sub === t.id ? ' is-active' : ''}`} onClick={() => setSub(t.id)}>{t.label}</button>)}
          </div>

          {sub === 'summary' && (
            <>
              <div className="admin-overview-grid">
                <Card label="Current stage" value={rec.stage} />
                <Card label="Active plan" value={rec.activePlan?.id ?? '—'} />
                <Card label="Active cycle" value={rec.cycleId ?? '—'} />
                <Card label="Pre-test score" value={pct(rec.prePercent)} />
                <Card label="Post-test score" value={pct(rec.postPercent)} />
                <Card label="Percentage-point difference" value={diff(rec.ppDiff)} />
                <Card label="Project-relevant modules" value={String(rec.projectRelevantModuleIds.length)} />
                <Card label="Recommended to study" value={String(rec.recommendedToStudy.length)} />
                <Card label="Already understood" value={String(rec.alreadyUnderstood.length)} />
                <Card label="Completed recommended" value={`${rec.completedRecommendedCount} / ${rec.recommendedToStudy.length}`} />
                <Card label="Conceptual" value={rec.conceptualStatusOverall} />
                <Card label="Practical" value={rec.practicalStatusOverall} />
              </div>
              {rec.activePlan?.projectSpecification ? (
                <p className="admin-section__hint" style={{ marginTop: 10 }}><strong>Project specification:</strong> {rec.activePlan.projectSpecification.slice(0, 280)}{rec.activePlan.projectSpecification.length > 280 ? '…' : ''}</p>
              ) : null}
              <p className="admin-section__hint" style={{ marginTop: 6 }}><strong>Interpretation:</strong> {rec.interpretation}</p>
              <p className="admin-section__hint"><strong>Suggested PM action:</strong> <span className="nt-badge nt-badge--action">{rec.suggestedAction}</span> <em>(decision support only)</em></p>

              <h3 style={{ marginTop: 18 }}>Module Recommendation Summary</h3>
              <h4 className="nt-muted">Project-Relevant Modules ({rec.projectRelevantModuleIds.length})</h4>
              <div className="nt-chips">{rec.recommendations.map((m) => <span key={m.moduleId} className="nt-chip-sm">{m.moduleTitle}</span>)}</div>

              <h4 className="nt-muted" style={{ marginTop: 12 }}>Recommended to Study ({rec.recommendedToStudy.length})</h4>
              {rec.recommendedToStudy.length === 0 ? <p className="admin-section__hint">None — all project-relevant modules were already understood.</p> : (
                <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Category</th><th>Pre-Test</th><th>Reason</th><th>Progress</th><th>Conceptual</th><th>Practical</th></tr></thead>
                  <tbody>{rec.recommendedToStudy.map((m) => <tr key={m.moduleId}><td><strong>{m.moduleTitle}</strong></td><td className="nt-muted">{m.category}</td><td>{pct(m.preTestPercentage)}</td><td className="nt-muted">{m.recommendationReason}</td><td>{m.progressPercent}%</td><td>{m.conceptualStatus}</td><td>{m.practicalStatus}</td></tr>)}</tbody></table></div>
              )}

              <h4 className="nt-muted" style={{ marginTop: 12 }}>Already Understood / Skipped ({rec.alreadyUnderstood.length})</h4>
              {rec.alreadyUnderstood.length === 0 ? <p className="admin-section__hint">None.</p> : (
                <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Category</th><th>Pre-Test</th><th>Reason</th></tr></thead>
                  <tbody>{rec.alreadyUnderstood.map((m) => <tr key={m.moduleId}><td><strong>{m.moduleTitle}</strong></td><td className="nt-muted">{m.category}</td><td>{pct(m.preTestPercentage)}</td><td className="nt-muted">{m.recommendationReason}</td></tr>)}</tbody></table></div>
              )}
            </>
          )}

          {sub === 'path' && (
            <div className="nt-table-scroll"><table className="nt-records-table">
              <thead><tr><th>Module</th><th>Category</th><th>Pre-Test</th><th>Recommendation</th><th>Reason</th><th>Assigned/Skipped</th><th>Progress</th><th>Conceptual</th><th>Practical</th><th>Post-Test</th><th>Final Status</th></tr></thead>
              <tbody>{rec.recommendations.map((m) => <RecRow key={m.moduleId} m={m} />)}</tbody>
            </table></div>
          )}

          {sub === 'assessments' && (
            <>
              <h3>Formal Pre-Test</h3>
              {rec.preScore && preAttempt ? (
                <p className="admin-section__hint">Cycle <span className="nt-mono">{rec.cycleId}</span> · modules covered: {rec.projectRelevantModuleIds.length} · raw {rec.preScore.correct}/{rec.preScore.total} · {pct(rec.prePercent)} · submitted {preAttempt.createdAt.slice(0, 10)}</p>
              ) : <p className="admin-section__hint">No pre-test attempt recorded.</p>}

              <h3 style={{ marginTop: 14 }}>In-Module Conceptual Assessment</h3>
              {rec.recommendations.length === 0 ? <p className="admin-section__hint">No project-relevant modules.</p> : (
                <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Conceptual Status</th><th>Progress</th></tr></thead>
                  <tbody>{rec.recommendations.map((m) => <tr key={m.moduleId}><td>{m.moduleTitle}</td><td>{m.conceptualStatus}</td><td>{m.progressPercent}%</td></tr>)}</tbody></table></div>
              )}

              <h3 style={{ marginTop: 14 }}>Practical Assessment</h3>
              {rec.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').length === 0 ? <p className="admin-section__hint">No practical-bearing project-relevant modules.</p> : (
                <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Expected Pattern</th><th>Status</th></tr></thead>
                  <tbody>{rec.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').map((m) => <tr key={m.moduleId}><td>{m.moduleTitle}</td><td className="nt-muted">{moduleById.get(m.moduleId)?.practicalExam?.patternName ?? '—'}</td><td>{m.practicalStatus}</td></tr>)}</tbody></table></div>
              )}

              <h3 style={{ marginTop: 14 }}>Formal Post-Test</h3>
              {rec.postScore && postAttempt ? (
                <p className="admin-section__hint">Paired cycle <span className="nt-mono">{rec.cycleId}</span> · raw {rec.postScore.correct}/{rec.postScore.total} · {pct(rec.postPercent)} · submitted {postAttempt.createdAt.slice(0, 10)} · <strong>{diff(rec.ppDiff)}</strong> vs the same cycle&rsquo;s pre-test</p>
              ) : <p className="admin-section__hint">No post-test attempt recorded for this cycle.</p>}
            </>
          )}

          {sub === 'practical' && (
            <div className="nt-table-scroll"><table className="nt-records-table">
              <thead><tr><th>Module</th><th>Expected Pattern</th><th>Submitted</th><th>Result</th></tr></thead>
              <tbody>
                {rec.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').map((m) => {
                  const submitted = (detail?.answers ?? []).some((a) => a.moduleId === m.moduleId && a.questionKind === 'practical');
                  return <tr key={m.moduleId}><td>{m.moduleTitle}</td><td className="nt-muted">{moduleById.get(m.moduleId)?.practicalExam?.patternName ?? '—'}</td><td>{submitted ? 'Yes' : 'No'}</td><td>{m.practicalStatus}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="admin-section__hint" style={{ marginTop: 6 }}>Note: a dedicated documentation-based checking summary is not persisted; the result column reflects completion/submission state only.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
