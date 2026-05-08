import { useEffect, useState } from 'react';
import { fetchAdminAudit, AdminAuditEntry } from '../../api/client';
import { fmtDate } from '../../logic/patterns';
import { isAuthError } from '../lib/silenceAuthErrors';

// Append-only feed of destructive admin actions (run deletions, log purges).
// There is no clear/delete control here on purpose — this view exists for
// accountability and the table is read-only by design.
export default function AuditPanel() {
  const [entries, setEntries] = useState<AdminAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminAudit(200)
      .then(d => setEntries(d.entries || []))
      .catch(e => { if (isAuthError(e)) { setEntries([]); return; } setError(e.message); });
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">{error}</div>;
  if (entries === null) return <div className="empty-state">Loading audit entries…</div>;
  if (entries.length === 0) return <div className="empty-state">No destructive admin actions recorded.</div>;

  return (
    <div className="logs-table-wrap">
      <table className="logs-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id}>
              <td className="logs-td-date">{fmtDate(e.created_at)}</td>
              <td>{e.actor_username ?? '—'}</td>
              <td><strong>{e.action}</strong></td>
              <td><code>{e.target_kind}{e.target_id ? `#${e.target_id}` : ''}</code></td>
              <td className="logs-td-msg">{e.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
