import { useEffect, useMemo, useState } from 'react';
import { fetchAdminLearningModules } from '../../api/client';
import { isAuthError } from '../lib/silenceAuthErrors';
import type { AdminLearningModule } from '../../types/api';

const CATEGORY_ORDER = ['foundations', 'creational', 'structural', 'behavioural', 'idioms'];

// Learning-module CONTENT management (NOT analytics). Lists every module's
// content/metadata + enabled state + question count. Publish/enable toggles and
// the AI course plan live in Course Plan; this view links there to avoid a
// duplicate destination.
export default function ModulesTab({ onManageCoursePlan }: { onManageCoursePlan: () => void }): JSX.Element {
  const [modules, setModules] = useState<AdminLearningModule[] | null>(null);
  const [error, setError] = useState<{ kind: 'auth' | 'generic'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchAdminLearningModules()
      .then((res) => { if (alive) { setModules(res); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        if (isAuthError(e)) setError({ kind: 'auth', message: 'Not authorized, or session expired.' });
        else setError({ kind: 'generic', message: e instanceof Error ? e.message : 'Failed to load modules.' });
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const rows = useMemo(() => {
    const list = modules ?? [];
    const q = query.trim().toLowerCase();
    return [...list]
      .filter((m) => !q || m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .sort((a, b) => {
        const c = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        return c !== 0 ? c : a.id.localeCompare(b.id);
      });
  }, [modules, query]);

  return (
    <section className="admin-section admin-section--card" aria-label="Learning module management">
      <header className="admin-section__head">
        <h2>Learning Modules</h2>
        <p className="admin-section__hint">Module content and metadata. Enable/disable for a project and the AI course plan are managed in <button type="button" className="nt-linkbtn" onClick={onManageCoursePlan}>Course Plan</button>.</p>
      </header>
      <div className="nt-records-toolbar">
        <input type="search" className="nt-records-search" placeholder="Search modules…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search modules" />
      </div>
      {loading ? (
        <p className="admin-section__hint" role="status">Loading modules…</p>
      ) : error ? (
        <div className="admin-error" role="alert"><p>{error.message}</p>{error.kind === 'generic' ? <button type="button" className="ghost-btn" onClick={() => setReloadKey((k) => k + 1)}>Retry</button> : null}</div>
      ) : rows.length === 0 ? (
        <p className="admin-section__hint">No modules found.</p>
      ) : (
        <div className="nt-table-scroll">
          <table className="nt-records-table">
            <thead><tr><th>Module</th><th>Identifier</th><th>Category</th><th>Enabled</th><th>Seed</th><th>Content</th><th>In-Module Questions</th><th>Practical</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.title}</strong></td>
                  <td className="nt-mono nt-muted">{m.id}</td>
                  <td className="nt-muted">{m.category}</td>
                  <td><span className="nt-badge" data-stage={m.published ? 'Ready for Post-Test' : 'Awaiting Pre-Test'}>{m.published ? 'Enabled' : 'Disabled'}</span></td>
                  <td>{m.isSeed ? 'Seed' : '—'}</td>
                  <td>{m.theoreticalExam || m.practicalExam ? 'Authored' : '—'}</td>
                  <td>{m.theoreticalExam?.questions?.length ?? 0}</td>
                  <td className="nt-muted">{m.practicalExam?.patternName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
