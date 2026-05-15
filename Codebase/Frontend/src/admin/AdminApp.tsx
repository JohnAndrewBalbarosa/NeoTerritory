import { useEffect, useState, ComponentType, FormEvent } from 'react';
import { useAppStore } from '../store/appState';
import { login as apiLogin } from '../api/client';
import type { User } from '../types/api';
import { useTheme } from '../hooks/useTheme';
import { useHealth } from '../hooks/useHealth';
import { useOverflowGuard } from '../hooks/useOverflowGuard';
import AuroraBackground from '../components/marketing/effects/AuroraBackground';
import RunsTab from './components/RunsTab';
import ComplexityTab from './components/ComplexityTab';
import UserTable from './components/UserTable';
import PerUserActivity from './components/PerUserActivity';
import LogsView from './components/LogsView';
import SurveyStats from './components/SurveyStats';
import ReviewsPanel from './components/ReviewsPanel';
import AiConfigPanel from './components/AiConfigPanel';
import { markAdminRefresh } from '../api/client';
import {
  IconLayers, IconBeaker, IconShield, IconCheckSquare, IconClipboard, IconCode
} from '../components/icons/Icons';
import type { IconProps } from '../components/icons/Icons';
import { useAdminUsers } from './hooks/useAdminUsers';

type AdminTab = 'runs' | 'complexity' | 'users' | 'reviews' | 'ai' | 'logs';

const TABS: Array<{ id: AdminTab; label: string; icon: ComponentType<IconProps> }> = [
  { id: 'runs',       label: 'Runs',       icon: IconLayers },
  { id: 'complexity', label: 'Complexity', icon: IconBeaker },
  { id: 'users',      label: 'Users',      icon: IconShield },
  { id: 'reviews',    label: 'Reviews',    icon: IconCheckSquare },
  { id: 'ai',         label: 'AI',         icon: IconCode },
  { id: 'logs',       label: 'Logs',       icon: IconClipboard }
];

export default function AdminApp() {
  const { token, user, setAuth, clearAuth, status, msState, msLabel, dockerState, dockerLabel, aiConfigured } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  // Seed backend / microservice / docker status on mount so the topbar
  // shows the same ops state the studio header surfaces. Admin is the
  // operations dashboard — without this, an operator could not see at
  // a glance whether the analyzer is healthy.
  useHealth();
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

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (token && user && user.role !== 'admin') {
      setLoginError('That account is not an admin. Sign in with an admin account.');
      clearAuth();
    }
  }, [token, user, clearAuth]);

  async function onAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusy) return;
    setLoginError(null);
    setLoginBusy(true);
    try {
      const { token: nextToken, user: nextUser } = await apiLogin(loginUsername.trim(), loginPassword);
      if (!nextUser || nextUser.role !== 'admin') {
        setLoginError('That account is not an admin.');
        return;
      }
      setAuth(nextToken, nextUser as User);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setLoginError(message || 'Sign-in failed');
    } finally {
      setLoginBusy(false);
    }
  }

  if (!token || !user || user.role !== 'admin') {
    return (
      <div className="admin-shell admin-shell--login">
        <AuroraBackground variant="warm" className="admin-aurora" />
        <main className="admin-login-wrap">
          <section className="admin-section admin-section--card admin-login-card">
            <header className="admin-section__head">
              <p className="eyebrow">NeoTerritory · Admin</p>
              <h1 className="brand-title">Sign in</h1>
              <p className="admin-section__hint">Admin credentials only. Non-admin accounts are rejected here.</p>
            </header>
            <form className="admin-login-form" onSubmit={onAdminLogin}>
              <label className="admin-login-field">
                <span>Username</span>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  disabled={loginBusy}
                />
              </label>
              <label className="admin-login-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loginBusy}
                />
              </label>
              {loginError && (
                <p className="admin-login-error" role="alert">{loginError}</p>
              )}
              <button type="submit" className="ghost-btn" disabled={loginBusy}>
                {loginBusy ? 'Signing in…' : 'Sign in to admin'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  function onLogout() { clearAuth(); window.location.href = '/'; }
  function onRefresh() {
    // Tag the upcoming admin refresh batch so the backend's
    // adminRefreshLimiter can hard-cap explicit refreshes (12/min/user).
    // Background polling never sets this flag, so it stays unaffected.
    markAdminRefresh(2000);
    setRefreshKey(k => k + 1);
    refreshAdminUsers();
  }

  return (
    <div className="admin-shell">
      <AuroraBackground variant="warm" className="admin-aurora" />
      <header className="admin-topbar reveal">
        <div className="brand">
          <p className="eyebrow">NeoTerritory · Admin</p>
          {/* Solid-color title — same call as studio: a marketing
              shimmer on a working operations dashboard reads as
              decorative noise. Plain h1 = solid theme accent. */}
          <h1 className="brand-title">Research dashboard</h1>
          <p className="lede">Activity, scoring, and qualitative reviews across all tester accounts.</p>
        </div>
        <div className="admin-actions">
          {/* Operations status row — backend health + microservice +
              docker. Admin is the ops dashboard, so it should see the
              same status the studio header shows. Compact pills, not
              full status card. */}
          <div className="admin-ops-pills" role="status" aria-live="polite">
            <span className="admin-ops-pill" data-state={status.kind}>
              <span className="admin-ops-dot" aria-hidden="true" />
              <span className="admin-ops-label">API</span>
              <strong>{status.title}</strong>
            </span>
            <span className="admin-ops-pill" data-state={msState}>
              <span className="admin-ops-dot" aria-hidden="true" />
              <span className="admin-ops-label">Microservice</span>
              <strong>{msLabel}</strong>
            </span>
            <span className="admin-ops-pill" data-state={dockerState}>
              <span className="admin-ops-dot" aria-hidden="true" />
              <span className="admin-ops-label">Docker</span>
              <strong>{dockerLabel}</strong>
            </span>
            {/* AI pill — reads from /api/health.aiProviderConfigured.
                Click navigates to the AI tab where the operator can flip
                the provider, model, and API key without redeploying. */}
            <button
              type="button"
              className="admin-ops-pill admin-ops-pill--btn"
              data-state={aiConfigured ? 'online' : 'offline'}
              onClick={() => setActiveTab('ai')}
              title={aiConfigured ? 'AI configured — click to manage' : 'AI not configured — click to set provider + key'}
            >
              <span className="admin-ops-dot" aria-hidden="true" />
              <span className="admin-ops-label">AI</span>
              <strong>{aiConfigured ? 'configured' : 'not configured'}</strong>
            </button>
          </div>
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
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`admin-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="admin-tab-btn__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="admin-tab-btn__icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="admin-tab-btn__label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/*
       * Tabs are rendered once on AdminApp mount and kept in the DOM. Switching
       * tabs only toggles `hidden`, so each tab's `useEffect(() => fetch(), [])`
       * runs exactly once per refresh epoch. The top-right `Refresh` button is
       * the only re-fetch trigger: bumping `refreshKey` remounts <main>, which
       * forces every tab to re-run its initial fetch in lockstep. This stops
       * the per-switch network spam without lifting state into a context.
       */}
      <main className="admin-main" key={refreshKey}>
        <div hidden={activeTab !== 'runs'}>
          <RunsTab />
        </div>
        <div hidden={activeTab !== 'complexity'}>
          <ComplexityTab />
        </div>
        <div hidden={activeTab !== 'users'}>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>Users</h2>
              <p className="admin-section__hint">Tester accounts, online presence, and seat reset controls.</p>
            </header>
            <UserTable />
          </section>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>Per-user activity</h2>
              <p className="admin-section__hint">Run counts and recent activity per tester.</p>
            </header>
            <PerUserActivity />
          </section>
        </div>
        <div hidden={activeTab !== 'reviews'}>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>Reviews</h2>
              <p className="admin-section__hint">Per-pattern reviewer answers submitted from the studio.</p>
            </header>
            <ReviewsPanel />
          </section>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>Survey responses</h2>
              <p className="admin-section__hint">Per-run + end-of-session feedback ratings and free-text answers.</p>
            </header>
            <SurveyStats />
          </section>
        </div>
        <div hidden={activeTab !== 'ai'}>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>AI provider configuration</h2>
              <p className="admin-section__hint">
                Pick the provider, model, and API key the documentation + commentary jobs should call.
                Changes take effect on the next AI request — no redeploy. Setting the provider to
                &ldquo;None&rdquo; clears the row and falls back to environment variables.
              </p>
            </header>
            <AiConfigPanel />
          </section>
        </div>
        <div hidden={activeTab !== 'logs'}>
          <LogsView />
        </div>
      </main>
    </div>
  );
}
