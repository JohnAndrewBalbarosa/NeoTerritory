import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appState';
import { useTheme } from '../hooks/useTheme';
import RunsTab from './components/RunsTab';
import ComplexityTab from './components/ComplexityTab';
import UserTable from './components/UserTable';
import LogsView from './components/LogsView';
import { fetchAdminReviews } from '../api/client';
import { AdminReview } from '../types/api';

type AdminTab = 'runs' | 'complexity' | 'users' | 'reviews' | 'logs';

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'runs',       label: 'Runs' },
  { id: 'complexity', label: 'Complexity' },
  { id: 'users',      label: 'Users' },
  { id: 'reviews',    label: 'Reviews' },
  { id: 'logs',       label: 'Logs' }
];

function ReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchAdminReviews()
      .then(r => setReviews(r.reviews))
      .catch(e => setError(e.message));
  }, []);
  if (error) return <div className="empty-state admin-error" role="alert">{error}</div>;
  if (!reviews) return <div className="empty-state">Loading…</div>;
  if (reviews.length === 0) return <div className="empty-state">No reviews yet.</div>;
  return (
    <table className="f1-pattern-table">
      <thead>
        <tr>
          <th>User</th><th>Scope</th><th>Source</th><th>Version</th><th>Date</th>
        </tr>
      </thead>
      <tbody>
        {reviews.map((r, i) => (
          <tr key={i}>
            <td>{r.username ?? '—'}</td>
            <td>{r.scope}</td>
            <td>{r.sourceName ?? '—'}</td>
            <td>{r.schemaVersion}</td>
            <td>{r.createdAt?.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminApp() {
  const { token, user, clearAuth } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('runs');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token || !user) { window.location.href = '/'; return; }
    if (user.role !== 'admin') window.location.href = '/';
  }, [token, user]);

  if (!token || !user || user.role !== 'admin') return null;

  function onLogout() { clearAuth(); window.location.href = '/'; }
  function onRefresh() { setRefreshKey(k => k + 1); }

  return (
    <div className="admin-shell">
      <header className="admin-topbar reveal">
        <div className="brand">
          <p className="eyebrow">NeoTerritory · Admin</p>
          <h1>Research dashboard</h1>
          <p className="lede">Activity, scoring, and qualitative reviews across all tester accounts.</p>
        </div>
        <div className="admin-actions">
          <span id="admin-user-label">{user.username} · admin</span>
          <button
            className="ghost-btn theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button id="admin-refresh-btn" className="ghost-btn" type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button id="admin-logout-btn" className="ghost-btn" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tab-bar" aria-label="Admin sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="admin-main" key={refreshKey}>
        {activeTab === 'runs'       && <RunsTab />}
        {activeTab === 'complexity' && <ComplexityTab />}
        {activeTab === 'users'      && (
          <section className="admin-section">
            <h2>Users</h2>
            <UserTable />
          </section>
        )}
        {activeTab === 'reviews' && (
          <section className="admin-section">
            <h2>Reviews</h2>
            <ReviewsPanel />
          </section>
        )}
        {activeTab === 'logs' && <LogsView />}
      </main>
    </div>
  );
}
