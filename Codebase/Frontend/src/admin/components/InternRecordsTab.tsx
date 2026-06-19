import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningInterns } from '../../api/client';
import { isAuthError } from '../lib/silenceAuthErrors';
import { useLearningModules } from '../../data/useLearningModules';
import {
  deriveLearnerLearningRecord,
  type RawLearnerRecord,
  type LearnerLearningRecord,
  type LearnerStage,
} from '../learning/deriveLearnerLearningRecord';

const STAGE_FILTERS: Array<'All' | LearnerStage> = [
  'All', 'Awaiting Pre-Test', 'Pre-Test Completed', 'Learning in Progress', 'Ready for Post-Test', 'Post-Test Completed', 'Needs Review',
];

function pct(n: number | null): string {
  return n === null ? '—' : `${n}%`;
}
function diff(n: number | null): string {
  return n === null ? '—' : `${n > 0 ? '+' : ''}${n} pp`;
}

function StageBadge({ stage }: { stage: LearnerStage }): JSX.Element {
  return <span className="nt-badge" data-stage={stage}>{stage}</span>;
}

// PM Intern Learning Records — real per-learner data from
// GET /api/admin/learning/interns, graded via the shared derivation helper.
export default function InternRecordsTab({ onSelectIntern }: { onSelectIntern: (internId: number) => void }): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [raw, setRaw] = useState<RawLearnerRecord[] | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [stage, setStage] = useState<'All' | LearnerStage>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchAdminLearningInterns()
      .then((res) => { if (alive) { setRaw(res.interns); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        if (isAuthError(e)) setError({ kind: 'auth', message: 'You are not authorized to view intern records, or your session expired.' });
        else setError({ kind: 'generic', message: e instanceof Error ? e.message : 'Failed to load intern records.' });
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const records: LearnerLearningRecord[] = useMemo(() => {
    if (!raw || !loaded) return [];
    return raw.map((r) => deriveLearnerLearningRecord(r, modules));
  }, [raw, modules, loaded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (stage !== 'All' && r.stage !== stage) return false;
      if (q && !(r.displayName.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [records, stage, query]);

  return (
    <section className="admin-section admin-section--card" aria-label="Intern learning records">
      <header className="admin-section__head">
        <h2>Intern Learning Records</h2>
        <p className="admin-section__hint">Per-learner project-relevant modules, formal pre/post results, and recommended study — graded read-only from stored records.</p>
      </header>

      <div className="nt-records-toolbar">
        <input
          type="search"
          className="nt-records-search"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search interns"
        />
        <div className="nt-records-filters" role="group" aria-label="Stage filter">
          {STAGE_FILTERS.map((s) => (
            <button key={s} type="button" className={`nt-chip${stage === s ? ' is-active' : ''}`} onClick={() => setStage(s)}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="admin-section__hint" role="status">Loading intern records…</p>
      ) : error ? (
        <div className="admin-error" role="alert">
          <p>{error.message}</p>
          {error.kind === 'generic' ? (
            <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
          ) : null}
        </div>
      ) : filtered.length === 0 ? (
        <p className="admin-section__hint">{records.length === 0 ? 'No interns have learning records yet.' : 'No interns match the current filter.'}</p>
      ) : (
        <div className="nt-table-scroll">
          <table className="nt-records-table">
            <thead>
              <tr>
                <th>Intern</th><th>Current Stage</th><th>Active Cycle</th><th>Pre-Test</th>
                <th>Project-Relevant</th><th>Recommended to Study</th><th>Already Understood</th>
                <th>Completed Rec.</th><th>Conceptual</th><th>Practical</th><th>Post-Test</th>
                <th>Score Diff</th><th>Suggested PM Action</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.internId}>
                  <td><strong>{r.displayName}</strong>{r.email ? <div className="nt-muted">{r.email}</div> : null}</td>
                  <td><StageBadge stage={r.stage} /></td>
                  <td className="nt-muted nt-mono">{r.cycleId ? r.cycleId.slice(0, 8) : '—'}</td>
                  <td>{pct(r.prePercent)}</td>
                  <td>{r.projectRelevantModuleIds.length}</td>
                  <td>
                    {r.recommendedToStudy.length}
                    {r.recommendedToStudy.length > 0 ? (
                      <div className="nt-chips">{r.recommendedToStudy.slice(0, 3).map((m) => <span key={m.moduleId} className="nt-chip-sm" title={m.moduleTitle}>{m.moduleTitle}</span>)}{r.recommendedToStudy.length > 3 ? <span className="nt-chip-sm">+{r.recommendedToStudy.length - 3}</span> : null}</div>
                    ) : null}
                  </td>
                  <td>{r.alreadyUnderstood.length}</td>
                  <td>{r.completedRecommendedCount} / {r.recommendedToStudy.length}</td>
                  <td>{r.conceptualStatusOverall}</td>
                  <td>{r.practicalStatusOverall}</td>
                  <td>{pct(r.postPercent)}</td>
                  <td>{diff(r.ppDiff)}</td>
                  <td><span className="nt-badge nt-badge--action">{r.suggestedAction}</span></td>
                  <td><button type="button" className="ghost-btn" onClick={() => onSelectIntern(r.internId)}>View Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
