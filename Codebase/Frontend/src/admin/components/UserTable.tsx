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

function isTesterRow(u: AdminUser): boolean {
  return /^Devcon/i.test(u.username || '');
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
  const [resetting, setResetting] = useState<'all' | 'selected' | 'offline' | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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

  function toggleSelected(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runReset(mode: 'all' | 'selected' | 'offline') {
    let confirmMsg = '';
    let arg: Parameters<typeof resetTesterSeats>[0];
    if (mode === 'selected') {
      if (!selected.size) return;
      confirmMsg = `Reset ${selected.size} selected tester seat(s)? Active tokens stay valid; the seat just becomes re-claimable.`;
      arg = { userIds: Array.from(selected) };
    } else if (mode === 'offline') {
      confirmMsg = 'Reset all offline tester seats (no activity in last 5 min)? Online testers are skipped.';
      arg = { offlineOnly: true };
    } else {
      confirmMsg = 'Reset ALL tester seats (online and offline)? Active tokens stay valid but seats become re-claimable.';
      arg = undefined;
    }
    if (!confirm(confirmMsg)) return;
    setResetting(mode);
    try {
      const res = await resetTesterSeats(arg);
      if (mode === 'selected') setSelected(new Set());
      load();
      alert(`Reset ${res.reset} seat(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(null);
    }
  }

  if (error) return <div className="empty-state admin-error" role="alert">Failed to load users: {error}</div>;
  if (users === null) return <div className="empty-state">Loading users…</div>;

  const q = query.toLowerCase();
  const filtered = q
    ? users.filter(u => u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
    : users;
  const visible = applySort(filtered, sortKey);

  const visibleTesterIds = visible.filter(isTesterRow).map(u => u.id);
  const allVisibleSelected = visibleTesterIds.length > 0
    && visibleTesterIds.every(id => selected.has(id));
  const onlineCount = users.filter(u => isOnline(u.last_active)).length;

  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleTesterIds) next.delete(id);
      } else {
        for (const id of visibleTesterIds) next.add(id);
      }
      return next;
    });
  }

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
        <span className="user-online-count" title="Active in last 5 min">{onlineCount} online</span>
        <button
          className={`user-ctrl-btn${sortKey !== 'none' ? ' is-active' : ''}`}
          onClick={cycleSort}
          title="Cycle sort order"
        >
          {SORT_LABELS[sortKey]}
        </button>
        <button
          className="user-ctrl-btn user-ctrl-btn--danger"
          onClick={() => runReset('selected')}
          disabled={resetting !== null || selected.size === 0}
          title="Reset only the checked tester rows"
        >
          {resetting === 'selected' ? 'Resetting…' : `Reset selected (${selected.size})`}
        </button>
        <button
          className="user-ctrl-btn"
          onClick={() => runReset('offline')}
          disabled={resetting !== null}
          title="Reset only tester seats whose last activity was over 5 min ago"
        >
          {resetting === 'offline' ? 'Resetting…' : 'Reset offline'}
        </button>
        <button
          className="user-ctrl-btn user-ctrl-btn--danger"
          onClick={() => runReset('all')}
          disabled={resetting !== null}
          title="Reset every tester seat"
        >
          {resetting === 'all' ? 'Resetting…' : 'Reset all'}
        </button>
        <button className="user-ctrl-btn" onClick={load} title="Refresh user list" aria-label="Refresh">↺</button>
      </div>

      {!users.length
        ? <div className="empty-state">No users.</div>
        : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible testers"
                    checked={allVisibleSelected}
                    disabled={visibleTesterIds.length === 0}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>User</th>
                <th>Role</th>
                <th>Runs</th>
                <th>Last run</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className="runs-disabled">
              {visible.map(u => {
                const tester = isTesterRow(u);
                return (
                  <tr key={u.id} data-id={u.id} data-username={u.username}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.username}`}
                        checked={selected.has(u.id)}
                        disabled={!tester}
                        onChange={() => toggleSelected(u.id)}
                        title={tester ? 'Select for reset' : 'Only tester (Devcon*) seats can be reset'}
                      />
                    </td>
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
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '20px' }}>
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
