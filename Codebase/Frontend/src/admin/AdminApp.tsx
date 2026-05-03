import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/appState';
import { useTheme } from '../hooks/useTheme';
import { useOverflowGuard } from '../hooks/useOverflowGuard';
import AuroraBackground from '../components/marketing/effects/AuroraBackground';
import ShinyText from '../components/marketing/effects/ShinyText';
import RunsTab from './components/RunsTab';
import ComplexityTab from './components/ComplexityTab';
import UserTable from './components/UserTable';
import PerUserActivity from './components/PerUserActivity';
import LogsView from './components/LogsView';
import SurveyStats from './components/SurveyStats';
import { fetchAdminReviews } from '../api/client';
import { AdminReview } from '../types/api';
import { useAdminUsers } from './hooks/useAdminUsers';
import { isAuthError } from './lib/silenceAuthErrors';

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
      .catch(e => {
        // Silence the pre-auth 401 race; treat as empty.
        if (isAuthError(e)) { setReviews([]); return; }
        setError(e.message);
      });
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
  // Topbar online pill — pulled from the same shared hook UserTable uses, so
  // both surfaces refresh together. Errors (incl. the pre-auth 401 race)
  // surface as 0 online instead of a red banner.
  // Admin polling cadence: 5 minutes is plenty for an operator dashboard
  // and keeps the API quiet so the rate limiter never bites the admin
  // session. The `Refresh` button below short-circuits the wait by
  // re-mounting children via `refreshKey` AND calling `refresh()` on the
  // shared hook, which resets its internal interval.
  const { onlineCount, users: adminUsers, refresh: refreshAdminUsers } = useAdminUsers(5 * 60_000);
  const [activeTab, setActiveTab] = useState<AdminTab>('runs');
  const [refreshKey, setRefreshKey] = useState(0);
  // Dev-only viewport overflow detector for the admin shell.
  useOverflowGuard({ rootSelector: '.admin-shell', tolerancePx: 2 });

  useEffect(() => {
    if (!token || !user) { window.location.href = '/'; return; }
    if (user.role !== 'admin') window.location.href = '/';
  }, [token, user]);

  if (!token || !user || user.role !== 'admin') return null;

  function onLogout() { clearAuth(); window.location.href = '/'; }
  function onRefresh() {
    setRefreshKey(k => k + 1);
    refreshAdminUsers();
  }

  return (
    <div className="admin-shell">
      <AuroraBackground variant="warm" className="admin-aurora" />
      <header className="admin-topbar reveal">
        <div className="brand">
          <p className="eyebrow">NeoTerritory · Admin</p>
          <h1><ShinyText text="Research dashboard" speed={6} intensity={0.6} /></h1>
          <p className="lede">Activity, scoring, and qualitative reviews across all tester accounts.</p>
        </div>
        <div className="admin-actions">
          <span
            className="admin-online-pill"
            data-empty={onlineCount === 0 ? 'true' : undefined}
            title="Active in last 2 min (heartbeat)"
          >
            <span className="admin-online-dot" aria-hidden="true" />
            {onlineCount === 0
              ? 'No users online'
              : `${onlineCount} of ${adminUsers.length} online`}
          </span>
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'runs'       && <RunsTab />}
            {activeTab === 'complexity' && <ComplexityTab />}
            {activeTab === 'users'      && (
              <>
                <section className="admin-section">
                  <h2>Users</h2>
                  <UserTable />
                </section>
                <section className="admin-section">
                  <h2>Per-user activity</h2>
                  <PerUserActivity />
                </section>
              </>
            )}
            {activeTab === 'reviews' && (
              <>
                <section className="admin-section">
                  <h2>Reviews</h2>
                  <ReviewsPanel />
                </section>
                <section className="admin-section">
                  <h2>Survey responses</h2>
                  <SurveyStats />
                </section>
              </>
            )}
            {activeTab === 'logs' && <LogsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
