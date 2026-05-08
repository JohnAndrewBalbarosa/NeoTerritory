import { useEffect, useState } from 'react';
import {
  fetchAdminRuns, deleteAdminRun, AdminRunRow, apiFetch
} from '../../api/client';
import { fmtDate } from '../../logic/patterns';
import { isAuthError } from '../lib/silenceAuthErrors';

interface AdminRunDetail {
  id: number;
  username?: string | null;
  sourceName: string;
  sourceText: string;
  analysis?: { files?: Array<{ name: string; sourceText: string }> } | null;
}

// Per-run admin control. Lets the operator delete a single saved analysis
// (e.g. test runs that pollute the metrics) with a confirmation step. Every
// deletion is recorded in audit_log (server-side); the audit panel below
// surfaces those entries and is itself non-deletable.
export default function RunsManager() {
  const [runs, setRuns] = useState<AdminRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminRunDetail | null>(null);
  const [detailFileIdx, setDetailFileIdx] = useState(0);

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

  async function onInspect(id: number) {
    try {
      const d = await apiFetch<AdminRunDetail>(`/api/admin/runs/${id}`);
      setDetail(d);
      setDetailFileIdx(0);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load run');
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
                  className="user-ctrl-btn"
                  onClick={() => onInspect(r.id)}
                  title="View the file(s) submitted for this run"
                >
                  Inspect
                </button>
                {' '}
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

      {detail && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="modal-card run-inspect-card" onClick={e => e.stopPropagation()}>
            <h3>Run #{detail.id} · {detail.sourceName}</h3>
            <p className="modal-lede">User: <strong>{detail.username ?? '—'}</strong></p>
            {(() => {
              const files = (detail.analysis?.files && detail.analysis.files.length > 0)
                ? detail.analysis.files
                : [{ name: detail.sourceName, sourceText: detail.sourceText }];
              const active = files[Math.min(detailFileIdx, files.length - 1)];
              return (
                <>
                  {files.length > 1 && (
                    <nav className="file-tab-bar" role="tablist" aria-label="Run files">
                      {files.map((f, i) => (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={i === detailFileIdx}
                          className={`file-tab-btn ${i === detailFileIdx ? 'is-active' : ''}`}
                          onClick={() => setDetailFileIdx(i)}
                          title={f.name}
                        >{f.name}</button>
                      ))}
                    </nav>
                  )}
                  <pre className="run-inspect-pre"><code>{active?.sourceText || ''}</code></pre>
                </>
              );
            })()}
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
