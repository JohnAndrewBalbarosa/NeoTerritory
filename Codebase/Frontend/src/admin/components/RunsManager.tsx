import { useEffect, useState } from 'react';
import {
  fetchAdminRuns, deleteAdminRun, AdminRunRow
} from '../../api/client';
import { fmtDate } from '../../lib/patterns';
import { isAuthError } from '../lib/silenceAuthErrors';

// Per-run admin control. Lets the operator delete a single saved analysis
// (e.g. test runs that pollute the metrics) with a confirmation step. Every
// deletion is recorded in audit_log (server-side); the audit panel below
// surfaces those entries and is itself non-deletable.
export default function RunsManager() {
  const [runs, setRuns] = useState<AdminRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  function load() {
    fetchAdminRuns(100)
      .then(d => setRuns(d.runs || []))
      .catch(e => { if (isAuthError(e)) { setRuns([]); return; } setError(e.message); });
  }

  useEffect(load, []);

  async function onDelete(id: number, label: string) {
    if (!confirm(`Permanently delete run #${id} (${label})? This goes into the audit log.`)) return;
    setBusy(id);
    try {
      await deleteAdminRun(id);
      setRuns(prev => (prev || []).filter(r => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="empty-state admin-error" role="alert">{error}</div>;
  if (runs === null) return <div className="empty-state">Loading runs…</div>;
  if (runs.length === 0) return <div className="empty-state">No analysis runs yet.</div>;

  return (
    <div className="logs-table-wrap">
      <table className="logs-table">
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Source</th>
            <th>Findings</th>
            <th>When</th>
            <th>—</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.username ?? '—'}</td>
              <td><code>{r.source_name}</code></td>
              <td>{r.findings_count}</td>
              <td className="logs-td-date">{fmtDate(r.created_at)}</td>
              <td>
                <button
                  type="button"
                  className="user-ctrl-btn user-ctrl-btn--danger"
                  disabled={busy === r.id}
                  onClick={() => onDelete(r.id, r.source_name)}
                  title="Delete this run (audited, non-reversible)"
                >
                  {busy === r.id ? 'Deleting…' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
