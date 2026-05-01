import { useEffect, useRef, useState } from 'react';
import { fetchAdminUsers, resetTesterSeats } from '../../api/client';
import { AdminUser } from '../../types/api';
import { fmtDate } from '../../lib/patterns';

const ONLINE_MS = 5 * 60 * 1000;

function isOnline(lastActive?: string): boolean {
  if (!lastActive) return false;
  const ago = Date.now() - new Date(lastActive + 'Z').getTime();
  return ago >= 0 && ago < ONLINE_MS;
}

type SortKey = 'none' | 'runs-desc' | 'runs-asc' | 'lastRun-desc' | 'lastRun-asc';

const SORT_CYCLE: SortKey[] = ['none', 'runs-desc', 'runs-asc', 'lastRun-desc', 'lastRun-asc'];

const SORT_LABELS: Record<SortKey, string> = {
  none: 'Sort',
  'runs-desc': 'Runs ↓',
  'runs-asc': 'Runs ↑',
  'lastRun-desc': 'Last run ↓',
  'lastRun-asc': 'Last run ↑',
};

function applySort(users: AdminUser[], key: SortKey): AdminUser[] {
  if (key === 'none') return users;
  return [...users].sort((a, b) => {
    if (key === 'runs-desc') return (b.runCount ?? 0) - (a.runCount ?? 0);
    if (key === 'runs-asc')  return (a.runCount ?? 0) - (b.runCount ?? 0);
    const ta = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const tb = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    return key === 'lastRun-desc' ? tb - ta : ta - tb;
  });
}

export default function UserTable() {
  const [users, setUsers]     = useState<AdminUser[] | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [query, setQuery]     = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [resetting, setResetting] = useState(false);
  const cancelledRef = useRef(false);

  function load() {
    fetchAdminUsers()
      .then(d => { if (!cancelledRef.current) setUsers(d.users ?? []); })
      .catch(err => { if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to load users'); });
  }

  useEffect(() => {
    cancelledRef.current = false;
    load();
    const timer = setInterval(load, 60_000);
    return () => { cancelledRef.current = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cycleSort() {
    setSortKey(k => SORT_CYCLE[(SORT_CYCLE.indexOf(k) + 1) % SORT_CYCLE.length]);
  }

  async function handleReset() {
    if (!confirm('Reset all tester seats? Active tokens stay valid but seats become re-claimable.')) return;
    setResetting(true);
    try {
      await resetTesterSeats();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  if (error) return <div className="empty-state admin-error" role="alert">Failed to load users: {error}</div>;
  if (users === null) return <div className="empty-state">Loading users…</div>;

  const q = query.toLowerCase();
  const filtered = q
    ? users.filter(u => u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
    : users;
  const visible = applySort(filtered, sortKey);

  return (
    <div>
      <div className="user-search-bar">
        <input
          type="search"
          className="user-search-input"
          placeholder="Filter by username or email…"
          value={query}
          maxLength={64}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter users"
        />
        {query && <span className="user-search-count">{visible.length} / {users.length}</span>}
        <button
          className={`user-ctrl-btn${sortKey !== 'none' ? ' is-active' : ''}`}
          onClick={cycleSort}
          title="Cycle sort order"
        >
          {SORT_LABELS[sortKey]}
        </button>
        <button
          className="user-ctrl-btn user-ctrl-btn--danger"
          onClick={handleReset}
          disabled={resetting}
          title="Reset all tester seat claims"
        >
          {resetting ? 'Resetting…' : 'Reset seats'}
        </button>
        <button className="user-ctrl-btn" onClick={load} title="Refresh user list" aria-label="Refresh">↺</button>
      </div>

      {!users.length
        ? <div className="empty-state">No users.</div>
        : (
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
            <tbody className="runs-disabled">
              {visible.map(u => (
                <tr key={u.id} data-id={u.id} data-username={u.username}>
                  <td>
                    <span className="user-name-cell">
                      {isOnline(u.last_active) && (
                        <span className="online-dot" title="Active in last 5 min" aria-label="online" />
                      )}
                      <strong>{u.username}</strong>
                    </span>
                    {u.email && <><br /><small>{u.email}</small></>}
                  </td>
                  <td>
                    <span className="role-pill" data-role={u.role ?? 'user'}>{u.role ?? 'user'}</span>
                  </td>
                  <td>{u.runCount ?? 0}</td>
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
        )}
    </div>
  );
}
