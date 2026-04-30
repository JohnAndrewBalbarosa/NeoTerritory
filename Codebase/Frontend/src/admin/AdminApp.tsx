import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appState';
import StatsCharts from './components/StatsCharts';
import UserTable from './components/UserTable';
import LogsView from './components/LogsView';

/**
 * AdminApp — research dashboard.
 * Surfaces all errors visibly in the UI (P0 fix — prior code logged silently).
 */
export default function AdminApp() {
  const { token, user, clearAuth } = useAppStore();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      window.location.href = '/';
      return;
    }
    if (user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [token, user]);

  if (!token || !user || user.role !== 'admin') return null;

  function onLogout() {
    clearAuth();
    window.location.href = '/';
  }

  function onRefresh() {
    setRefreshKey(k => k + 1);
  }

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
          <button id="admin-refresh-btn" className="ghost-btn" type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button id="admin-logout-btn" className="ghost-btn" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      {/* refreshKey forces remount of subsections to re-fetch */}
      <main className="admin-main" key={refreshKey}>
        <section className="admin-section">
          <h2>Overview</h2>
          <StatsCharts />
        </section>
        <section className="admin-section">
          <h2>Users</h2>
          <UserTable />
        </section>
        <LogsView />
      </main>
    </div>
  );
}
