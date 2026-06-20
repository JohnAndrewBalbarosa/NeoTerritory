import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInterns, fetchAdminLearningRaw } from '../../api/client';
import type { AdminLearningRaw, LearningRawQuestionResult } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import { downloadCsv } from '../logic/toCsv';
import type { RawLearnerRecord } from '../learning/deriveLearnerLearningRecord';
import {
  summarizeInModuleAnalytics, deriveLearnerAnalytics, deriveModuleAnalytics, deriveQuestionAnalytics,
  MIN_SAMPLE_LEARNERS,
} from '../learning/inModuleAnalytics';

// Local-only analytics views. These NEVER change the global sidebar tab
// (which stays on In-Module Analytics) — they are component state.
type View = 'overview' | 'learner-attempts' | 'learner-detail' | 'module-attempts' | 'module-detail' | 'question-performance';
const VIEW_TABS: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'learner-attempts', label: 'Intern Attempts' },
  { id: 'module-attempts', label: 'Module Attempts' },
  { id: 'question-performance', label: 'Question Performance' },
];
type LearnerFilter = 'All' | 'With Retries' | 'No Activity' | 'In Progress' | 'Completed' | 'Needs Review';
const LEARNER_FILTERS: LearnerFilter[] = ['All', 'With Retries', 'No Activity', 'In Progress', 'Completed', 'Needs Review'];

const rate = (n: number | null) => (n === null ? 'Not Attempted' : `${n}%`);

export default function InModuleAnalyticsTab(): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [raw, setRaw] = useState<RawLearnerRecord[] | null>(null);
  const [learningRaw, setLearningRaw] = useState<AdminLearningRaw | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<View>('overview');
  const [internId, setInternId] = useState<number | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LearnerFilter>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.allSettled([fetchAdminLearningInterns(), fetchAdminLearningRaw()]).then(([interns, lr]) => {
      if (!alive) return;
      setLoading(false);
      if (interns.status === 'fulfilled') setRaw(interns.value.interns);
      else if (isAuthError(interns.reason)) setError({ kind: 'auth', message: 'Not authorized, or your session expired.' });
      else setError({ kind: 'generic', message: interns.reason instanceof Error ? interns.reason.message : 'Failed to load analytics.' });
      if (lr.status === 'fulfilled') setLearningRaw(lr.value);
    });
    return () => { alive = false; };
  }, [reloadKey]);

  const qr: LearningRawQuestionResult[] = learningRaw?.questionResults ?? [];
  const ready = raw !== null && loaded;
  const summary = useMemo(() => (ready ? summarizeInModuleAnalytics(raw!, qr, modules) : null), [ready, raw, qr, modules]);
  const learnerRows = useMemo(() => (ready ? deriveLearnerAnalytics(raw!, qr, modules) : []), [ready, raw, qr, modules]);
  const moduleRows = useMemo(() => (ready ? deriveModuleAnalytics(raw!, qr, modules) : []), [ready, raw, qr, modules]);
  const questionRows = useMemo(() => (ready ? deriveQuestionAnalytics(qr, modules) : []), [ready, qr, modules]);
  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const filteredLearners = useMemo(() => {
    const q = query.trim().toLowerCase();
    return learnerRows.filter((l) => {
      if (q && !l.displayName.toLowerCase().includes(q) && !(l.email ?? '').toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'With Retries': return l.retriedQuestions > 0;
        case 'No Activity': return l.conceptualAttempts === 0 && l.practicalSubmissions === 0;
        case 'In Progress': return l.stage === 'Learning in Progress' || l.stage === 'Pre-Test Completed';
        case 'Completed': return l.stage === 'Post-Test Completed';
        case 'Needs Review': return l.stage === 'Needs Review';
        default: return true;
      }
    });
  }, [learnerRows, filter, query]);

  function openLearner(id: number) { setInternId(id); setView('learner-detail'); }
  function openModule(id: string) { setModuleId(id); setView('module-detail'); }

  function exportCurrent() {
    if (view === 'module-attempts') downloadCsv('in-module-module-attempts.csv', ['moduleId', 'title', 'category', 'learnersRecommended', 'learnersStarted', 'learnersCompleted', 'conceptualAttempts', 'practicalSubmissions', 'avgAttemptsPerStartedLearner', 'questionsWithRetries', 'firstTryRate', 'eventualRate', 'maxAttemptCount', 'status'], moduleRows.map((m) => [m.moduleId, m.title, m.category, m.learnersRecommended, m.learnersStarted, m.learnersCompleted, m.conceptualAttempts, m.practicalSubmissions, m.avgAttemptsPerStartedLearner ?? '', m.questionsWithRetries, m.firstTryRate ?? '', m.eventualRate ?? '', m.maxAttemptCount, m.status]));
    else if (view === 'question-performance') downloadCsv('in-module-question-performance.csv', ['moduleId', 'questionId', 'bloom', 'learnersAttempted', 'totalAttempts', 'firstAttemptCorrectCount', 'firstAttemptRate', 'eventualCorrectCount', 'eventualRate', 'retriedLearners', 'status'], questionRows.map((q) => [q.moduleId, q.questionId, q.bloom ?? '', q.learnersAttempted, q.totalAttempts, q.firstAttemptCorrectCount, q.firstAttemptRate ?? '', q.eventualCorrectCount, q.eventualRate ?? '', q.retriedLearners, q.status]));
    else downloadCsv('in-module-learner-attempts.csv', ['internId', 'displayName', 'email', 'stage', 'recommendedModules', 'modulesStarted', 'modulesCompleted', 'conceptualAttempts', 'practicalSubmissions', 'retriedQuestions', 'avgAttemptsPerStartedModule', 'latestActivity'], learnerRows.map((l) => [l.internId, l.displayName, l.email ?? '', l.stage, l.recommendedModuleIds.length, l.modulesStarted, l.modulesCompleted, l.conceptualAttempts, l.practicalSubmissions, l.retriedQuestions, l.avgAttemptsPerStartedModule ?? '', l.latestActivity ?? '']));
  }

  if (loading) return <section className="admin-section admin-section--card"><p className="admin-section__hint" role="status">Loading in-module analytics…</p></section>;
  if (error) return <section className="admin-section admin-section--card"><div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div></section>;

  // --- Detail views (local; sidebar stays on In-Module Analytics) ---
  if (view === 'learner-detail' && internId !== null) {
    const l = learnerRows.find((x) => x.internId === internId);
    const myQr = qr.filter((q) => q.userId === internId);
    const byModule = new Map<string, LearningRawQuestionResult[]>();
    for (const q of myQr) { const a = byModule.get(q.moduleId) ?? []; a.push(q); byModule.set(q.moduleId, a); }
    const recRec = raw!.find((r) => r.internId === internId);
    const practicalMods = new Set((recRec?.answers ?? []).filter((a) => a.questionKind === 'practical').map((a) => a.moduleId));
    return (
      <section className="admin-section admin-section--card">
        <header className="admin-section__head"><button type="button" className="ghost-btn" onClick={() => setView('learner-attempts')}>← Back to Intern Attempts</button><h3 style={{ marginTop: 8 }}>{l?.displayName ?? `Intern #${internId}`}{l?.email ? <span className="nt-muted"> · {l.email}</span> : null}</h3><p className="nt-muted">Stage: {l?.stage ?? '—'} · Cycle: {l?.cycleId?.slice(0, 8) ?? '—'}</p></header>
        <div className="admin-overview-grid">
          <div className="admin-overview-card"><p className="admin-overview-card__title">Recommended Modules</p><p className="admin-overview-card__value">{l?.recommendedModuleIds.length ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Modules Started</p><p className="admin-overview-card__value">{l?.modulesStarted ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Modules Completed</p><p className="admin-overview-card__value">{l?.modulesCompleted ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Conceptual Attempts</p><p className="admin-overview-card__value">{l?.conceptualAttempts ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Questions With Retries</p><p className="admin-overview-card__value">{l?.retriedQuestions ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Practical Submissions</p><p className="admin-overview-card__value">{l?.practicalSubmissions ?? 0}</p></div>
        </div>
        <h4 style={{ marginTop: 14 }}>Module Attempts</h4>
        {(l?.recommendedModuleIds.length ?? 0) === 0 ? <p className="admin-section__hint">No recommended modules were found for this intern.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Module</th><th>Questions Attempted</th><th>Conceptual Attempts</th><th>Retried Questions</th><th>First-Try Rate</th><th>Eventual Rate</th><th>Practical</th><th>Status</th></tr></thead>
            <tbody>{l!.recommendedModuleIds.map((mid) => {
              const rows = byModule.get(mid) ?? [];
              const first = rows.filter((r) => r.firstAttemptCorrect === 1).length;
              const evt = rows.filter((r) => r.isCorrect === 1).length;
              const attempted = rows.length;
              const status = attempted === 0 ? 'Not Started' : rows.some((r) => r.attempts > 1) ? 'Repeated Attempts' : evt === attempted ? 'Completed' : 'In Progress';
              return <tr key={mid}><td>{moduleById.get(mid)?.title ?? mid}</td><td>{attempted || 'Not Attempted'}</td><td>{rows.reduce((s, r) => s + r.attempts, 0)}</td><td>{rows.filter((r) => r.attempts > 1).length}</td><td>{attempted ? `${Math.round((first / attempted) * 100)}%` : 'Not Attempted'}</td><td>{attempted ? `${Math.round((evt / attempted) * 100)}%` : 'Not Attempted'}</td><td>{!moduleById.get(mid)?.practicalExam ? 'Not Applicable' : practicalMods.has(mid) ? 'Submitted' : 'Not Submitted'}</td><td><span className="nt-badge" data-stage={status === 'Completed' ? 'Post-Test Completed' : status === 'Repeated Attempts' ? 'Needs Review' : status === 'In Progress' ? 'Learning in Progress' : 'Awaiting Pre-Test'}>{status}</span></td></tr>;
            })}</tbody></table></div>
        )}
        <h4 style={{ marginTop: 14 }}>Question Attempts</h4>
        <p className="admin-section__hint">Individual attempt-by-attempt history is not stored; this view shows the available aggregate attempt record.</p>
        {myQr.length === 0 ? <p className="admin-section__hint">No conceptual attempts recorded yet.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Question</th><th>Total Attempts</th><th>First-Attempt</th><th>Latest/Eventual</th><th>Status</th></tr></thead>
            <tbody>{myQr.map((q) => {
              const mod = moduleById.get(q.moduleId); const qq = mod?.theoreticalExam?.questions[q.questionIndex];
              const status = q.firstAttemptCorrect === 1 ? 'Correct on First Attempt' : q.isCorrect === 1 ? 'Correct After Retry' : 'Still Incorrect';
              return <tr key={`${q.moduleId}-${q.questionIndex}`}><td className="nt-muted">{mod?.title ?? q.moduleId}</td><td>{qq && qq.type !== 'studio' ? qq.question.slice(0, 80) : `Q${q.questionIndex + 1}`}</td><td>{q.attempts}</td><td>{q.firstAttemptCorrect === 1 ? 'Correct' : 'Incorrect'}</td><td>{q.isCorrect === 1 ? 'Correct' : 'Incorrect'}</td><td><span className="nt-badge" data-stage={status === 'Still Incorrect' ? 'Needs Review' : 'Post-Test Completed'}>{status}</span></td></tr>;
            })}</tbody></table></div>
        )}
        <h4 style={{ marginTop: 14 }}>Practical Activity</h4>
        {(l?.recommendedModuleIds.filter((mid) => moduleById.get(mid)?.practicalExam).length ?? 0) === 0 ? <p className="admin-section__hint">No practical-bearing recommended modules.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Module</th><th>Expected Pattern</th><th>Submission Status</th></tr></thead>
            <tbody>{l!.recommendedModuleIds.filter((mid) => moduleById.get(mid)?.practicalExam).map((mid) => <tr key={mid}><td>{moduleById.get(mid)?.title ?? mid}</td><td className="nt-muted">{moduleById.get(mid)?.practicalExam?.patternName ?? '—'}</td><td>{practicalMods.has(mid) ? 'Submitted' : 'Not Submitted'}</td></tr>)}</tbody></table></div>
        )}
      </section>
    );
  }

  if (view === 'module-detail' && moduleId !== null) {
    const m = moduleRows.find((x) => x.moduleId === moduleId);
    const modQr = qr.filter((q) => q.moduleId === moduleId);
    const learnersInMod = Array.from(new Set(modQr.map((q) => q.userId)));
    const qRows = questionRows.filter((q) => q.moduleId === moduleId);
    return (
      <section className="admin-section admin-section--card">
        <header className="admin-section__head"><button type="button" className="ghost-btn" onClick={() => setView('module-attempts')}>← Back to Module Attempts</button><h3 style={{ marginTop: 8 }}>{m?.title ?? moduleId}<span className="nt-muted"> · {m?.category}</span></h3></header>
        <div className="admin-overview-grid">
          <div className="admin-overview-card"><p className="admin-overview-card__title">Interns Recommended</p><p className="admin-overview-card__value">{m?.learnersRecommended ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Interns Started</p><p className="admin-overview-card__value">{m?.learnersStarted ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Interns Completed</p><p className="admin-overview-card__value">{m?.learnersCompleted ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Conceptual Attempts</p><p className="admin-overview-card__value">{m?.conceptualAttempts ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Practical Submissions</p><p className="admin-overview-card__value">{m?.practicalSubmissions ?? 0}</p></div>
          <div className="admin-overview-card"><p className="admin-overview-card__title">Questions With Retries</p><p className="admin-overview-card__value">{m?.questionsWithRetries ?? 0}</p></div>
        </div>
        {m && m.learnersStarted > 0 && m.learnersStarted < MIN_SAMPLE_LEARNERS ? <p className="admin-section__hint">Limited data — only {m.learnersStarted} intern attempted this module.</p> : null}
        <h4 style={{ marginTop: 14 }}>Intern performance in this module</h4>
        {learnersInMod.length === 0 ? <p className="admin-section__hint">No interns have attempted this module.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Intern</th><th>Conceptual Attempts</th><th>Retried Questions</th><th>First-Try Rate</th><th>Eventual Rate</th><th></th></tr></thead>
            <tbody>{learnersInMod.map((uid) => {
              const rows = modQr.filter((q) => q.userId === uid);
              const lr = learnerRows.find((x) => x.internId === uid);
              const attempted = rows.length;
              return <tr key={uid}><td>{lr?.displayName ?? uid}</td><td>{rows.reduce((s, r) => s + r.attempts, 0)}</td><td>{rows.filter((r) => r.attempts > 1).length}</td><td>{attempted ? `${Math.round((rows.filter((r) => r.firstAttemptCorrect === 1).length / attempted) * 100)}%` : 'Not Attempted'}</td><td>{attempted ? `${Math.round((rows.filter((r) => r.isCorrect === 1).length / attempted) * 100)}%` : 'Not Attempted'}</td><td><button type="button" className="ghost-btn" onClick={() => openLearner(uid)}>View Intern</button></td></tr>;
            })}</tbody></table></div>
        )}
        <h4 style={{ marginTop: 14 }}>Questions in this module</h4>
        {qRows.length === 0 ? <p className="admin-section__hint">No conceptual attempts recorded yet.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table"><thead><tr><th>Question</th><th>Interns</th><th>First-Try Rate</th><th>Eventual Rate</th><th>Interns Retried</th><th>Status</th></tr></thead>
            <tbody>{qRows.map((q) => <tr key={q.questionId}><td>{q.prompt.slice(0, 80)}</td><td>{q.learnersAttempted}</td><td>{rate(q.firstAttemptRate)}</td><td>{rate(q.eventualRate)}</td><td>{q.retriedLearners}</td><td><span className="nt-badge">{q.status}</span></td></tr>)}</tbody></table></div>
        )}
      </section>
    );
  }

  // --- Main page (Overview / Learner Attempts / Module Attempts / Question Performance) ---
  return (
    <section className="admin-section admin-section--card" aria-label="In-module learning analytics">
      <header className="admin-section__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2>In-Module Learning Analytics</h2>
          <p className="admin-section__hint">Monitor how interns work through recommended learning modules, including conceptual attempts, retries, practical submissions, completion, and question-level performance. Formal pre-test and post-test records remain under Assessments.</p>
          <p className="admin-section__hint">These are descriptive process metrics. Whether a module is Required or Optional Review is per-intern (it depends on each intern’s pre-test result), so it is shown in Intern Detail, not here. Voluntary attempts on optional modules appear as activity and never count as an incomplete requirement.</p>
        </div>
        <div className="admin-account-actions">
          <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Refresh</button>
          <button type="button" className="ghost-btn" onClick={exportCurrent}>Export CSV</button>
        </div>
      </header>

      <div className="nt-records-filters" role="tablist" aria-label="Analytics views" style={{ marginBottom: 12 }}>
        {VIEW_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={view === t.id} className={`nt-chip${view === t.id ? ' is-active' : ''}`} onClick={() => setView(t.id)}>{t.label}</button>)}
      </div>

      {view === 'overview' && summary && (
        <>
          <div className="admin-overview-grid">
            <div className="admin-overview-card"><p className="admin-overview-card__title">Interns With Activity</p><p className="admin-overview-card__value">{summary.internsWithActivity}</p></div>
            <div className="admin-overview-card"><p className="admin-overview-card__title">Recommended Modules Started</p><p className="admin-overview-card__value">{summary.recommendedModulesStarted}</p></div>
            <div className="admin-overview-card"><p className="admin-overview-card__title">Recommended Modules Completed</p><p className="admin-overview-card__value">{summary.recommendedModulesCompleted}</p></div>
            <div className="admin-overview-card"><p className="admin-overview-card__title">Total Conceptual Attempts</p><p className="admin-overview-card__value">{learningRaw ? summary.totalConceptualAttempts : '—'}</p><p className="admin-overview-card__sub">{learningRaw ? 'in-module question attempts' : 'Unavailable'}</p></div>
            <div className="admin-overview-card"><p className="admin-overview-card__title">Total Practical Submissions</p><p className="admin-overview-card__value">{summary.totalPracticalSubmissions}</p></div>
            <div className="admin-overview-card"><p className="admin-overview-card__title">Interns With Retries</p><p className="admin-overview-card__value">{summary.learnersWithRetries}</p></div>
          </div>
          <h3 style={{ marginTop: 16 }}>Module Activity Summary</h3>
          {moduleRows.length === 0 ? <p className="admin-section__hint">No module activity recorded yet.</p> : (
            <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Module</th><th>Recommended</th><th>Started</th><th>Completed</th><th>Conceptual Attempts</th><th>Questions w/ Retries</th><th>Practical</th><th>Status</th><th></th></tr></thead>
              <tbody>{moduleRows.map((m) => <tr key={m.moduleId}><td>{m.title}</td><td>{m.learnersRecommended}</td><td>{m.learnersStarted}</td><td>{m.learnersCompleted}</td><td>{m.conceptualAttempts}</td><td>{m.questionsWithRetries}</td><td>{m.practicalSubmissions}</td><td><span className="nt-badge">{m.status}</span></td><td><button type="button" className="ghost-btn" onClick={() => openModule(m.moduleId)}>View Module</button></td></tr>)}</tbody></table></div>
          )}
        </>
      )}

      {view === 'learner-attempts' && (
        <>
          <div className="nt-records-toolbar">
            <input type="search" className="nt-records-search" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search interns" />
            <div className="nt-records-filters" role="group" aria-label="Intern filter">{LEARNER_FILTERS.map((f) => <button key={f} type="button" className={`nt-chip${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}</div>
          </div>
          {filteredLearners.length === 0 ? <p className="admin-section__hint">No interns match the current filter.</p> : (
            <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Intern</th><th>Recommended</th><th>Started</th><th>Completed</th><th>Conceptual Attempts</th><th>Practical Submissions</th><th>Retried Questions</th><th>Avg Attempts/Started</th><th>Latest Activity</th><th>Stage</th><th></th></tr></thead>
              <tbody>{filteredLearners.map((l) => (
                <tr key={l.internId}>
                  <td><strong>{l.displayName}</strong>{l.email ? <div className="nt-muted">{l.email}</div> : null}</td>
                  <td>{l.recommendedModuleIds.length}{l.recommendedModuleTitles.length ? <div className="nt-chips">{l.recommendedModuleTitles.slice(0, 2).map((t, i) => <span key={i} className="nt-chip-sm" title={t}>{t}</span>)}{l.recommendedModuleTitles.length > 2 ? <span className="nt-chip-sm">+{l.recommendedModuleTitles.length - 2}</span> : null}</div> : null}</td>
                  <td>{l.modulesStarted}</td><td>{l.modulesCompleted}</td>
                  <td>{l.conceptualAttempts === 0 ? '0' : l.conceptualAttempts}</td>
                  <td>{l.practicalSubmissions}</td>
                  <td>{l.retriedQuestions}</td>
                  <td>{l.avgAttemptsPerStartedModule === null ? 'No activity' : l.avgAttemptsPerStartedModule}</td>
                  <td className="nt-muted">{l.latestActivity ? l.latestActivity.slice(0, 10) : '—'}</td>
                  <td><span className="nt-badge" data-stage={l.stage}>{l.stage}</span></td>
                  <td><button type="button" className="ghost-btn" onClick={() => openLearner(l.internId)}>View Activity</button></td>
                </tr>
              ))}</tbody></table></div>
          )}
        </>
      )}

      {view === 'module-attempts' && (
        moduleRows.length === 0 ? <p className="admin-section__hint">No module activity recorded yet.</p> : (
          <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Module</th><th>Category</th><th>Recommended</th><th>Started</th><th>Completed</th><th>Conceptual Attempts</th><th>Practical</th><th>Avg/Started</th><th>Questions w/ Retries</th><th>First-Try</th><th>Eventual</th><th>Most Attempts</th><th>Status</th><th></th></tr></thead>
            <tbody>{moduleRows.map((m) => <tr key={m.moduleId}><td>{m.title}</td><td className="nt-muted">{m.category}</td><td>{m.learnersRecommended}</td><td>{m.learnersStarted}</td><td>{m.learnersCompleted}</td><td>{m.conceptualAttempts}</td><td>{m.practicalSubmissions}</td><td>{m.avgAttemptsPerStartedLearner ?? 'No activity'}</td><td>{m.questionsWithRetries}</td><td>{rate(m.firstTryRate)}</td><td>{rate(m.eventualRate)}</td><td className="nt-muted">{m.learnerWithMostAttempts ? `${m.learnerWithMostAttempts} (${m.maxAttemptCount})` : '—'}</td><td><span className="nt-badge">{m.status}</span></td><td><button type="button" className="ghost-btn" onClick={() => openModule(m.moduleId)}>View Module</button></td></tr>)}</tbody></table></div>
        )
      )}

      {view === 'question-performance' && (
        <>
          <h3>In-Module Question Performance</h3>
          {questionRows.length === 0 ? <p className="admin-section__hint">No conceptual attempts recorded yet.</p> : (
            <div className="nt-table-scroll"><table className="nt-records-table nt-sticky-1"><thead><tr><th>Module</th><th>Question</th><th>Bloom</th><th>Interns</th><th>Total Attempts</th><th>First-Try Correct</th><th>First-Try Rate</th><th>Eventual Correct</th><th>Eventual Rate</th><th>Interns Retried</th><th>Status</th></tr></thead>
              <tbody>{questionRows.map((q) => <tr key={q.questionId}><td className="nt-muted">{q.moduleTitle}</td><td>{q.prompt.slice(0, 70)}</td><td className="nt-muted">{q.bloom ?? '—'}</td><td>{q.learnersAttempted}</td><td>{q.totalAttempts}</td><td>{q.firstAttemptCorrectCount}</td><td>{rate(q.firstAttemptRate)}</td><td>{q.eventualCorrectCount}</td><td>{rate(q.eventualRate)}</td><td>{q.retriedLearners}</td><td><span className="nt-badge">{q.status}</span></td></tr>)}</tbody></table></div>
          )}
        </>
      )}
    </section>
  );
}
