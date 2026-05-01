import { useState } from 'react';
import { resetTesterSeats } from '../../api/client';
import { AdminUser } from '../../types/api';
import { fmtDate } from '../../lib/patterns';
import { useAdminUsers, isOnline } from '../hooks/useAdminUsers';

function isTesterRow(u: AdminUser): boolean {
  return /^Devcon/i.test(u.username || '');
}

type SortKey = 'none' | 'runs-desc' | 'runs-asc' | 'lastRun-desc' | 'lastRun-asc';
type PresenceFilter = 'all' | 'online' | 'offline';

const SORT_CYCLE: SortKey[] = ['none', 'runs-desc', 'runs-asc', 'lastRun-desc', 'lastRun-asc'];

const SORT_LABELS: Record<SortKey, string> = {
  none: 'Sort',
  'runs-desc': 'Runs ↓',
  'runs-asc': 'Runs ↑',
  'lastRun-desc': 'Last run ↓',
  'lastRun-asc': 'Last run ↑',
};

const PRESENCE_CYCLE: PresenceFilter[] = ['all', 'online', 'offline'];
const PRESENCE_LABELS: Record<PresenceFilter, string> = {
  all: 'All',
  online: 'Online only',
  offline: 'Offline only'
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
  // Shared admin-users hook. Errors (including the 401 "Missing or invalid
  // token" race) are swallowed and surfaced as an empty list, so we never
  // render a red banner for a transient pre-auth fetch.
  const { users, loading, refresh: load } = useAdminUsers(60_000);
  const [query, setQuery]     = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [presence, setPresence] = useState<PresenceFilter>('all');
  const [resetting, setResetting] = useState<'all' | 'selected' | 'offline' | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function cycleSort() {
    setSortKey(k => SORT_CYCLE[(SORT_CYCLE.indexOf(k) + 1) % SORT_CYCLE.length]);
  }

  function cyclePresence() {
    setPresence(p => PRESENCE_CYCLE[(PRESENCE_CYCLE.indexOf(p) + 1) % PRESENCE_CYCLE.length]);
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

  if (loading) return <div className="empty-state">Loading users…</div>;

  const q = query.toLowerCase();
  let filtered = q
    ? users.filter(u => u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
    : users;
  if (presence === 'online') filtered = filtered.filter(u => isOnline(u.last_active));
  else if (presence === 'offline') filtered = filtered.filter(u => !isOnline(u.last_active));
  const visible = applySort(filtered, sortKey);

  const visibleTesterIds = visible.filter(isTesterRow).map(u => u.id);
  const allVisibleSelected = visibleTesterIds.length > 0
    && visibleTesterIds.every(id => selected.has(id));

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
        <button
          className={`user-ctrl-btn${presence !== 'all' ? ' is-active' : ''}`}
          onClick={cyclePresence}
          title="Cycle presence filter (All / Online / Offline)"
        >
          {PRESENCE_LABELS[presence]}
        </button>
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
                        {isOnline(u.last_active)
                          ? <span className="online-dot is-online" title="Active in last 2 min" aria-label="online" />
                          : <span className="online-dot is-offline" title="No heartbeat in last 2 min" aria-label="offline" />}
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
