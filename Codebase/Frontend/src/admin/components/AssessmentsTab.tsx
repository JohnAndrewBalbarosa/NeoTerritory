import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInterns } from '../../api/client';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import {
  deriveLearnerLearningRecord,
  listLearnerCycles,
  type RawLearnerRecord,
  type LearnerLearningRecord,
  type LearnerStage,
} from '../learning/deriveLearnerLearningRecord';
import { POST_TEST_STATUS_LABEL } from './AssessmentCycleDetailTab';

type SubTab = 'pretest' | 'conceptual' | 'practical' | 'posttest' | 'cycles';
const SUB_TABS: Array<{ id: SubTab; label: string }> = [
  { id: 'pretest', label: 'Pre-Test' },
  { id: 'conceptual', label: 'Conceptual' },
  { id: 'practical', label: 'Practical' },
  { id: 'posttest', label: 'Post-Test' },
  { id: 'cycles', label: 'Learning Cycles' },
];
const STAGE_FILTERS: Array<'All' | LearnerStage> = ['All', 'Awaiting Pre-Test', 'Pre-Test Completed', 'Learning in Progress', 'Ready for Post-Test', 'Post-Test Completed', 'Needs Review'];

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const diff = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} pp`);

interface CycleRecord { rec: RawLearnerRecord; cycleId: string; d: LearnerLearningRecord; }

export default function AssessmentsTab({ onOpenCycle, initialSubTab }: { onOpenCycle: (internId: number, cycleId: string) => void; initialSubTab?: SubTab }): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [raw, setRaw] = useState<RawLearnerRecord[] | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [sub, setSub] = useState<SubTab>(initialSubTab ?? 'pretest');
  const [stage, setStage] = useState<'All' | LearnerStage>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchAdminLearningInterns()
      .then((res) => { if (alive) { setRaw(res.interns); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        if (isAuthError(e)) setError({ kind: 'auth', message: 'Not authorized, or session expired.' });
        else setError({ kind: 'generic', message: e instanceof Error ? e.message : 'Failed to load assessments.' });
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const cycleRecords: CycleRecord[] = useMemo(() => {
    if (!raw || !loaded) return [];
    const out: CycleRecord[] = [];
    for (const rec of raw) {
      const cycles = listLearnerCycles(rec);
      if (cycles.length === 0) {
        out.push({ rec, cycleId: '', d: deriveLearnerLearningRecord(rec, modules) }); // awaiting pre-test
      } else {
        for (const cid of cycles) out.push({ rec, cycleId: cid, d: deriveLearnerLearningRecord(rec, modules, cid) });
      }
    }
    return out;
  }, [raw, modules, loaded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cycleRecords.filter(({ d }) => {
      if (stage !== 'All' && d.stage !== stage) return false;
      if (q && !d.displayName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cycleRecords, stage, query]);

  const attemptDate = (rec: RawLearnerRecord, type: 'pretest' | 'posttest', cycleId: string) =>
    rec.attempts.find((a) => a.assessmentType === type && a.cycleId === cycleId)?.createdAt?.slice(0, 10) ?? '—';
  const shortCycle = (c: string) => (c ? c.slice(0, 8) : '—');

  return (
    <section className="admin-section admin-section--card" aria-label="Formal assessment monitoring">
      <header className="admin-section__head">
        <h2>Assessments</h2>
        <p className="admin-section__hint">Formal pre-test, in-module conceptual, practical, post-test, and learning cycles — separate from In-Module Process Analytics.</p>
      </header>

      <div className="nt-records-filters" role="tablist" aria-label="Assessment type" style={{ marginBottom: 10 }}>
        {SUB_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={sub === t.id} className={`nt-chip${sub === t.id ? ' is-active' : ''}`} onClick={() => setSub(t.id)}>{t.label}</button>)}
      </div>
      <div className="nt-records-toolbar">
        <input type="search" className="nt-records-search" placeholder="Search by intern…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search interns" />
        <div className="nt-records-filters" role="group" aria-label="Stage filter">
          {STAGE_FILTERS.map((s) => <button key={s} type="button" className={`nt-chip${stage === s ? ' is-active' : ''}`} onClick={() => setStage(s)}>{s}</button>)}
        </div>
      </div>

      {loading ? <p className="admin-section__hint" role="status">Loading assessments…</p>
        : error ? <div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div>
        : filtered.length === 0 ? <p className="admin-section__hint">No matching assessment records.</p>
        : (
          <div className="nt-table-scroll">
            {sub === 'pretest' && (
              <table className="nt-records-table">
                <caption className="nt-cap">Formal Pre-Test</caption>
                <thead><tr><th>Intern</th><th>Cycle</th><th>Project-Relevant</th><th>Questions</th><th>Raw Score</th><th>%</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
                <tbody>{filtered.filter((c) => c.d.hasPreTest).map((c) => (
                  <tr key={`${c.rec.internId}-${c.cycleId}`}><td>{c.d.displayName}</td><td className="nt-mono">{shortCycle(c.cycleId)}</td><td>{c.d.projectRelevantModuleIds.length}</td><td>{c.d.preScore?.total ?? '—'}</td><td>{c.d.preScore?.correct ?? '—'}</td><td>{pct(c.d.prePercent)}</td><td className="nt-muted">{attemptDate(c.rec, 'pretest', c.cycleId)}</td><td><span className="nt-badge" data-stage={c.d.stage}>{c.d.stage}</span></td><td><button type="button" className="ghost-btn" onClick={() => onOpenCycle(c.rec.internId, c.cycleId)}>View Cycle</button></td></tr>
                ))}</tbody>
              </table>
            )}
            {sub === 'conceptual' && (
              <table className="nt-records-table">
                <caption className="nt-cap">In-Module Conceptual Assessment</caption>
                <thead><tr><th>Intern</th><th>Cycle</th><th>Module</th><th>Conceptual Status</th><th>Progress</th><th></th></tr></thead>
                <tbody>{filtered.flatMap((c) => c.d.recommendations.map((m) => (
                  <tr key={`${c.rec.internId}-${c.cycleId}-${m.moduleId}`}><td>{c.d.displayName}</td><td className="nt-mono">{shortCycle(c.cycleId)}</td><td>{m.moduleTitle}</td><td>{m.conceptualStatus}</td><td>{m.progressPercent}%</td><td><button type="button" className="ghost-btn" onClick={() => onOpenCycle(c.rec.internId, c.cycleId)}>View</button></td></tr>
                )))}</tbody>
              </table>
            )}
            {sub === 'practical' && (
              <table className="nt-records-table">
                <caption className="nt-cap">Practical Assessment</caption>
                <thead><tr><th>Intern</th><th>Cycle</th><th>Module</th><th>Expected Pattern</th><th>Submission Status</th><th></th></tr></thead>
                <tbody>{filtered.flatMap((c) => c.d.recommendations.filter((m) => m.practicalStatus !== 'Not applicable').map((m) => {
                  const submitted = c.rec.answers.some((a) => a.moduleId === m.moduleId && a.questionKind === 'practical');
                  return <tr key={`${c.rec.internId}-${c.cycleId}-${m.moduleId}`}><td>{c.d.displayName}</td><td className="nt-mono">{shortCycle(c.cycleId)}</td><td>{m.moduleTitle}</td><td className="nt-muted">{modules.find((mm) => mm.id === m.moduleId)?.practicalExam?.patternName ?? '—'}</td><td>{m.progressPercent >= 100 ? 'Completed' : submitted ? 'Submitted' : 'Not Submitted'}</td><td><button type="button" className="ghost-btn" onClick={() => onOpenCycle(c.rec.internId, c.cycleId)}>View</button></td></tr>;
                }))}</tbody>
              </table>
            )}
            {sub === 'posttest' && (
              <table className="nt-records-table">
                <caption className="nt-cap">Formal Post-Test</caption>
                <thead><tr><th>Intern</th><th>Cycle</th><th>Pre-Test</th><th>Post-Test</th><th>Score Diff</th><th>Post-Test Status</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
                <tbody>{filtered.filter((c) => c.d.hasPostTest).map((c) => (
                  <tr key={`${c.rec.internId}-${c.cycleId}`}><td>{c.d.displayName}</td><td className="nt-mono">{shortCycle(c.cycleId)}</td><td>{pct(c.d.prePercent)}</td><td>{pct(c.d.postPercent)}</td><td>{diff(c.d.ppDiff)}</td><td title={c.d.postTestReasonMessage}>{POST_TEST_STATUS_LABEL[c.d.postTestStatus]}</td><td className="nt-muted">{attemptDate(c.rec, 'posttest', c.cycleId)}</td><td><span className="nt-badge" data-stage={c.d.stage}>{c.d.stage}</span></td><td><button type="button" className="ghost-btn" onClick={() => onOpenCycle(c.rec.internId, c.cycleId)}>View Cycle</button></td></tr>
                ))}</tbody>
              </table>
            )}
            {sub === 'cycles' && (
              <table className="nt-records-table">
                <caption className="nt-cap">Learning Cycles</caption>
                <thead><tr><th>Intern</th><th>Cycle</th><th>Plan</th><th>Project-Relevant</th><th>Rec. to Study</th><th>Already Understood</th><th>Pre-Test</th><th>Post-Test</th><th>Score Diff</th><th>Status</th><th>Started</th><th></th></tr></thead>
                <tbody>{filtered.filter((c) => c.cycleId).map((c) => (
                  <tr key={`${c.rec.internId}-${c.cycleId}`}><td>{c.d.displayName}</td><td className="nt-mono">{shortCycle(c.cycleId)}</td><td className="nt-mono nt-muted">{c.d.activePlan?.id ?? '—'}</td><td>{c.d.projectRelevantModuleIds.length}</td><td>{c.d.recommendedToStudy.length}</td><td>{c.d.alreadyUnderstood.length}</td><td>{pct(c.d.prePercent)}</td><td>{pct(c.d.postPercent)}</td><td>{diff(c.d.ppDiff)}</td><td><span className="nt-badge" data-stage={c.d.stage}>{c.d.stage}</span></td><td className="nt-muted">{attemptDate(c.rec, 'pretest', c.cycleId)}</td><td><button type="button" className="ghost-btn" onClick={() => onOpenCycle(c.rec.internId, c.cycleId)}>View Details</button></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
    </section>
  );
}
