import { useEffect, useState, ComponentType, FormEvent } from 'react';
import { useAppStore } from '../store/appState';
import { login as apiLogin } from '../api/client';
import type { User } from '../types/api';
import { useTheme } from '../hooks/useTheme';
import { useHealth } from '../hooks/useHealth';
import { useOverflowGuard } from '../hooks/useOverflowGuard';
import AuroraBackground from '../components/marketing/effects/AuroraBackground';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import RunsTab from './components/RunsTab';
import ComplexityTab from './components/ComplexityTab';
import UserTable from './components/UserTable';
import PerUserActivity from './components/PerUserActivity';
import LogsView from './components/LogsView';
import SurveyStats from './components/SurveyStats';
import ReviewsPanel from './components/ReviewsPanel';
import AiConfigPanel from './components/AiConfigPanel';
import CatalogsTab from './components/CatalogsTab';
import InviteCodesTab from './components/InviteCodesTab';
import JoinRequestsTab from './components/JoinRequestsTab';
import FeatureReleasePanel from './components/FeatureReleasePanel';
import InstructorDashboard from './components/InstructorDashboard';
import CoursesTab from './components/CoursesTab';
import { markAdminRefresh } from '../api/client';
import {
  IconLayers, IconBeaker, IconShield, IconCheckSquare, IconClipboard, IconCode, IconBook
} from '../components/icons/Icons';
import type { IconProps } from '../components/icons/Icons';
import { useAdminUsers } from './hooks/useAdminUsers';

type AdminTab = 'runs' | 'complexity' | 'users' | 'reviews' | 'ai' | 'logs' | 'catalogs' | 'invites' | 'joinRequests' | 'featureReleases' | 'instructor-students' | 'instructor-modules' | 'instructor-questions' | 'courses';

type AdminSection = 'Operations' | 'People' | 'Instructor' | 'Research' | 'Config';

interface TabDef {
  id: AdminTab;
  label: string;
  icon: ComponentType<IconProps>;
  section: AdminSection;
  // When true, the tab is only shown for the original-devs org (thesis
  // team). Other admins do not see Complexity / Reviews because those
  // surfaces are anchored on the thesis study cohort, not arbitrary
  // user orgs.
  originalDevsOnly?: boolean;
}

const TABS: ReadonlyArray<TabDef> = [
  { id: 'runs',            label: 'Runs',            icon: IconLayers,      section: 'Operations' },
  { id: 'logs',            label: 'Logs',            icon: IconClipboard,   section: 'Operations' },
  { id: 'users',           label: 'Users',           icon: IconShield,      section: 'People' },
  { id: 'invites',         label: 'Invites',         icon: IconCheckSquare, section: 'People' },
  { id: 'joinRequests',    label: 'Join requests',   icon: IconShield,      section: 'People' },
  { id: 'instructor-students',  label: 'Students',   icon: IconShield,      section: 'Instructor' },
  { id: 'instructor-modules',   label: 'Modules',    icon: IconLayers,      section: 'Instructor' },
  { id: 'instructor-questions', label: 'Questions',  icon: IconClipboard,   section: 'Instructor' },
  { id: 'courses',              label: 'Courses',    icon: IconBook,        section: 'Instructor' },
  { id: 'complexity',      label: 'Complexity',      icon: IconBeaker,      section: 'Research', originalDevsOnly: true },
  { id: 'reviews',         label: 'Reviews',         icon: IconCheckSquare, section: 'Research', originalDevsOnly: true },
  { id: 'featureReleases', label: 'Feature releases',icon: IconCode,        section: 'Research', originalDevsOnly: true },
  { id: 'ai',              label: 'AI',              icon: IconCode,        section: 'Config' },
  { id: 'catalogs',        label: 'Pattern groups',  icon: IconBeaker,      section: 'Config' },
];

const SECTION_ORDER: AdminSection[] = ['Operations', 'People', 'Instructor', 'Research', 'Config'];
const TAB_SECTION_MAP: Record<AdminTab, AdminSection> = TABS.reduce((acc, tab) => {
  acc[tab.id] = tab.section;
  return acc;
}, {} as Record<AdminTab, AdminSection>);

const SECTION_CHILDREN: Record<AdminSection, AdminTab[]> = SECTION_ORDER.reduce((acc, section) => {
  acc[section] = TABS.filter((tab) => tab.section === section).map((tab) => tab.id);
  return acc;
}, {} as Record<AdminSection, AdminTab[]>);

// Original-devs detection: the JWT now carries an explicit
// isOriginalDevs flag (set by /auth/google/exchange when the email is
// in ORIGINAL_DEV_EMAILS). The legacy username/password admin (seeded
// 'Neoterritory') still passes through the username heuristic so the
// thesis admin login keeps working without Supabase configured.
function isOriginalDevsAdmin(
  user: { username: string; email?: string | null; isOriginalDevs?: boolean } | null,
): boolean {
  if (!user) return false;
  if (user.isOriginalDevs === true) return true;
  if (user.username && user.username.toLowerCase() === 'neoterritory') return true;
  return false;
}

// PM admin detection. PM users see the admin shell minus the research
// tabs (Complexity / Reviews / Feature releases) — those are scoped to
// the thesis cohort, not to project managers who run their own orgs.
function isPmAdmin(user: { role?: string } | null): boolean {
  if (!user) return false;
  return user.role === 'pm';
}

// Admin shell access. Accept the legacy users.role='admin' (seeded
// thesis admin) AND any OAuth user flagged isOriginalDevs (the
// original-devs allowlist matched). Self-serve admins keep
// users.role='user' + orgId set — they're deferred until we expand
// the gate to read JWT orgRole (see plan's "out of scope" note).
function isAdminAuthorized(
  user: { role: string; isOriginalDevs?: boolean } | null,
): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.isOriginalDevs === true;
}

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
  const [mountedTabs, setMountedTabs] = useState<Set<AdminTab>>(new Set(['runs']));
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedSection, setExpandedSection] = useState<AdminSection>(TAB_SECTION_MAP.runs);
  // Dev-only viewport overflow detector for the admin shell.
  useOverflowGuard({ rootSelector: '.admin-shell', tolerancePx: 2 });

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Legacy username/password form is now a collapsible fallback. The
  // primary admin sign-in is Google OAuth via /admin/login → callback →
  // /admin (handled by AuthChooserPage / GoogleSignInPage). The fallback
  // only exists for: (a) the seeded thesis admin `Neoterritory` user,
  // and (b) emergencies where Supabase auth is not configured on the
  // backend (AUTH_SUPABASE_SELF_HOSTED_URL unset). It defaults to
  // hidden so the surface reads as "Google sign-in is the way."
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (token && user && !isAdminAuthorized(user)) {
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

  if (!token || !user || !isAdminAuthorized(user)) {
    return (
      <div className="admin-shell admin-shell--login">
        <AuroraBackground variant="warm" className="admin-aurora" />
        <main className="admin-login-wrap">
          <section className="admin-section admin-section--card admin-login-card" data-testid="admin-login-shell">
            <header className="admin-section__head">
              <p className="eyebrow">CodiNeo · Admin</p>
              <h1 className="brand-title">Sign in as PM / admin</h1>
              <p className="admin-section__hint">
                Admins sign in with Google. Original-devs emails land sa NeoTerritory
                admin; ibang emails ay automatic self-serve org creation.
              </p>
            </header>

            <div className="admin-login-google">
              <GoogleSignInButton role="admin" redirectAfter="/admin" />
            </div>

            <details
              className="admin-login-legacy"
              open={legacyOpen}
              onToggle={(e) => setLegacyOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>
                Legacy sign-in (seeded thesis admin only)
              </summary>
              <p className="admin-section__hint">
                Hidden because OAuth is now the primary path. Use this only when
                the server has no Supabase config, or when you need the seeded
                <code>Neoterritory</code> admin account.
              </p>
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
                  {loginBusy ? 'Signing in…' : 'Sign in with username/password'}
                </button>
              </form>
            </details>
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
    setMountedTabs(new Set([activeTab]));
    setRefreshKey(k => k + 1);
    refreshAdminUsers();
  }

  function setTab(tab: AdminTab) {
    setActiveTab(tab);
    const section = TAB_SECTION_MAP[tab];
    setExpandedSection(section);
  }

  function toggleSection(section: AdminSection) {
    setExpandedSection(section);
  }

  return (
    <div className="admin-shell">
      <AuroraBackground variant="warm" className="admin-aurora" />
      <header className="admin-topbar reveal">
        <div className="brand">
          <p className="eyebrow">CodiNeo · Admin</p>
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
          <button
            id="admin-go-studio-btn"
            className="ghost-btn"
            type="button"
            data-testid="admin-go-studio"
            onClick={() => { window.location.assign('/studio'); }}
            title="Switch to my studio (full-page nav to the main SPA)"
          >
            Go to my studio →
          </button>
          <button id="admin-refresh-btn" className="ghost-btn" type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button id="admin-logout-btn" className="ghost-btn" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-body">
        <nav className="admin-tab-bar admin-sidebar" aria-label="Admin sections" data-testid="admin-tab-bar">
          {SECTION_ORDER.map((section) => {
            const tabs = SECTION_CHILDREN[section].map((id) => TABS.find((tab) => tab.id === id)!).filter((t) => {
              if (t.originalDevsOnly && isPmAdmin(user)) return false;
              if (t.originalDevsOnly && !isOriginalDevsAdmin(user)) return false;
              return true;
            });
            if (tabs.length === 0) return null;
            const isOpen = expandedSection === section;
            return (
              <div className="admin-sidebar__group" key={section}>
                <button
                  type="button"
                  className="admin-sidebar__section"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section)}
                >
                  <span className="admin-sidebar__section-caret" aria-hidden="true">
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span className="admin-sidebar__section-label">{section}</span>
                </button>
                {isOpen && (
                  <div className="admin-sidebar__children" role="group" aria-label={`${section} items`}>
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          className={`admin-tab-btn admin-tab-btn--child${activeTab === tab.id ? ' is-active' : ''}`}
                          type="button"
                          onClick={() => setTab(tab.id)}
                        >
                          <span className="admin-tab-btn__icon" aria-hidden="true"><Icon size={15} /></span>
                          <span className="admin-tab-btn__label">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

      {/*
       * Tabs are lazily mounted when first visited and kept in the DOM. Switching
       * to a visited tab only toggles `hidden`, so each tab's `useEffect(() => fetch(), [])`
       * runs exactly once per refresh epoch. The top-right `Refresh` button is
       * the only re-fetch trigger: bumping `refreshKey` remounts <main>, which
       * forces only the active tab to re-run its initial fetch. This stops
       * the initial mount network spam without lifting state into a context.
       */}
      <main className="admin-main" key={refreshKey}>
        {mountedTabs.has('runs') && (
          <div hidden={activeTab !== 'runs'}>
            <RunsTab />
          </div>
        )}
        {mountedTabs.has('complexity') && (
          <div hidden={activeTab !== 'complexity'}>
            <ComplexityTab />
          </div>
        )}
        {mountedTabs.has('users') && (
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
        )}
        {mountedTabs.has('reviews') && (
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
        )}
        {mountedTabs.has('ai') && (
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
        )}
        {mountedTabs.has('logs') && (
          <div hidden={activeTab !== 'logs'}>
            <LogsView />
          </div>
        )}
        {mountedTabs.has('catalogs') && (
          <div hidden={activeTab !== 'catalogs'}>
            <CatalogsTab />
          </div>
        )}
        {mountedTabs.has('invites') && (
          <div hidden={activeTab !== 'invites'}>
            <InviteCodesTab />
          </div>
        )}
        {mountedTabs.has('joinRequests') && (
          <div hidden={activeTab !== 'joinRequests'}>
            <JoinRequestsTab />
          </div>
        )}
        {(mountedTabs.has('instructor-students') || mountedTabs.has('instructor-modules') || mountedTabs.has('instructor-questions')) && (
          <div hidden={activeTab !== 'instructor-students' && activeTab !== 'instructor-modules' && activeTab !== 'instructor-questions'}>
            <section className="admin-section admin-section--card">
              <header className="admin-section__head">
                <h2>Instructor analytics</h2>
                <p className="admin-section__hint">Course-operator view of learner scores: per-student progress and improvement, module difficulty ranking, and the per-question heatmap. All metrics are computed from raw learning data; each view offers a download.</p>
              </header>
              <InstructorDashboard initialView={
                activeTab === 'instructor-modules' ? 'modules' :
                activeTab === 'instructor-questions' ? 'questions' :
                'students'
              } />
            </section>
          </div>
        )}
        {mountedTabs.has('courses') && (
          <div hidden={activeTab !== 'courses'}>
            <CoursesTab />
          </div>
        )}
        {isOriginalDevsAdmin(user) && mountedTabs.has('featureReleases') && (
          <div hidden={activeTab !== 'featureReleases'}>
            <FeatureReleasePanel />
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
