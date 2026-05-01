import { useEffect, useState } from 'react';
import { fetchAdminUsers } from '../../api/client';
import { AdminUser } from '../../types/api';
import { fmtDate } from '../../lib/patterns';

export default function UserTable() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers()
      .then(d => { if (!cancelled) setUsers(d.users || []); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load users'); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="empty-state admin-error" role="alert">Failed to load users: {error}</div>;
  }
  if (users === null) return <div className="empty-state">Loading users...</div>;
  if (!users.length) return <div className="empty-state">No users.</div>;

  const q = query.toLowerCase();
  const visible = q
    ? users.filter(u => u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    : users;

  return (
    <div>
      <div className="user-search-bar">
        <input
          type="search"
          className="user-search-input"
          placeholder="Filter by username or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter users"
        />
        {query && (
          <span className="user-search-count">{visible.length} / {users.length}</span>
        )}
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Runs</th>
            <th>Last run</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody id="users-tbody" className="runs-disabled">
          {visible.map(u => (
            <tr key={u.id} data-id={u.id} data-username={u.username}>
              <td>
                <strong>{u.username}</strong><br />
                <small>{u.email || ''}</small>
              </td>
              <td>
                <span className="role-pill" data-role={u.role || 'user'}>{u.role || 'user'}</span>
              </td>
              <td>{u.runCount || 0}</td>
              <td>{fmtDate(u.lastRunAt)}</td>
              <td>{fmtDate(u.created_at)}</td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '20px' }}>
                No users match "{query}"
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
