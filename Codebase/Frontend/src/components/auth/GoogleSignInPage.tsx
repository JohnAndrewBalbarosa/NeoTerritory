import { useState } from 'react';
import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';
import { useAppStore } from '../../store/appState';
import { resolveLearnerLanding } from '../../logic/learnerRouting';
import { fetchTesterAccounts, claimSeat, fetchRuns, fetchSample, pilotLogin } from '../../api/client';
import type { User } from '../../types/api';

// Sign-in page. After the learner-merge, the former 'developer' and 'student'
// entry flows are unified into a single 'learner' role: both /developer/login
// and /student-learning/login land here, sign in with Google, and route to
// the learner gate or learning path based on pre-test state. admin / pm / new
// keep their own behaviour.
//
// The learner page also offers a "Use guest only" button: it claims an open
// guest seat (a real but shared session) so the analyser works inside the
// practicals, while the learner page treats guest sessions as non-persisting
// (no saved runs or progress).

type Role = 'learner' | 'admin' | 'pm' | 'new';

function resolveRole(pathname: string): Role {
  if (pathname.startsWith('/admin/login')) return 'admin';
  if (pathname.startsWith('/pm/login')) return 'pm';
  if (pathname.startsWith('/new-user/login')) return 'new';
  // /student-learning/login (and any other learner entry) resolves to learner.
  return 'learner';
}

function resolveNext(role: Role): string {
  const preTestCompleted = useAppStore.getState().preTestCompleted;
  if (role === 'learner') return resolveLearnerLanding(preTestCompleted);
  if (role === 'admin' || role === 'pm') {
    const key = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADMIN_GATE_KEY;
    return key ? `/admin?key=${encodeURIComponent(key)}` : '/admin';
  }
  return '/onboarding/choose';
}

function resolveEyebrow(role: Role): string {
  if (role === 'learner') return 'Intern Access';
  if (role === 'admin') return 'Super admin access';
  if (role === 'pm') return 'Project manager access';
  return 'First-time setup';
}

function resolveLede(role: Role): string {
  if (role === 'learner') {
    return 'Sign in to save your learning progress and continue your assigned CodiNeo learning path.';
  }
  if (role === 'admin') {
    return 'For NeoTerritory original developers (Andrew / Miryl / Josephine) only. Other emails are redirected to PM sign-in.';
  }
  if (role === 'pm') {
    return 'Manage your own organization and pattern catalogs. New PMs get a fresh org on first sign-in.';
  }
  return 'Sign in with Google. Afterwards, the onboarding wizard will ask whether you are an admin or a developer.';
}

// Per-path testids pinned to the routes manifest selectors. (The /developer/login
// entry was retired with developer mode; learners use /student-learning/login.)
function resolveTestId(pathname: string): string {
  if (pathname.startsWith('/admin/login')) return 'admin-login';
  if (pathname.startsWith('/pm/login')) return 'pm-login';
  if (pathname.startsWith('/new-user/login')) return 'new-user-login';
  return 'student-login';
}

// "Use guest only" — claim the first open guest seat (a devcon{N} shared
// session) so /api/analyze works inside the practicals, then drop the learner
// into the learning path. Guest sessions are not persisted (the learning page
// skips progress save/fetch for devcon usernames).
function GuestOnlyButton(): JSX.Element {
  const setAuth = useAppStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function useGuest(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await fetchTesterAccounts();
      const open = data.accounts.find((a) => !a.claimed);
      if (!open) {
        setError('No guest seats are available right now. Sign in with Google instead.');
        return;
      }
      const { token, user } = await claimSeat(open.username);
      setAuth(token, user as User);
      await Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
      navigate(resolveLearnerLanding(useAppStore.getState().preTestCompleted));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a guest session. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nt-signin-guest">
      <button
        type="button"
        className="ghost-btn nt-signin-guest__btn"
        onClick={() => void useGuest()}
        disabled={busy}
        data-testid="use-guest-only"
      >
        {busy ? 'Starting guest session…' : 'Use guest only'}
      </button>
      {error && <p className="login-error">{error}</p>}
    </div>
  );
}

// DEV/TEST-ONLY pilot learner sign-in. Shown when ANY of these is true:
//   - build env  VITE_ENABLE_PILOT_LOGIN === 'true'  (Vite dev/build gate)
//   - URL query  ?pilot=1                            (no restart needed)
//   - localStorage 'nt_pilot_login' === '1'          (runtime toggle)
// This only controls button VISIBILITY. The real protection is server-side:
// the /auth/pilot-login endpoint 404s unless ENABLE_PILOT_LOGIN=true and not
// production, so showing the button can never grant access in prod. It does NOT
// touch Guest behavior or any role-based access.
function pilotLoginEnabled(): boolean {
  if ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ENABLE_PILOT_LOGIN === 'true') {
    return true;
  }
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('pilot') === '1') return true;
    if (window.localStorage.getItem('nt_pilot_login') === '1') return true;
  } catch {
    // ignore storage/URL access failures
  }
  return false;
}

function PilotLoginButton(): JSX.Element {
  const setAuth = useAppStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signInAsPilot(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { token, user } = await pilotLogin();
      setAuth(token, user);
      navigate('/pre-test');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pilot login is unavailable (enable ENABLE_PILOT_LOGIN on the server).');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nt-signin-guest">
      <button
        type="button"
        className="ghost-btn nt-signin-guest__btn"
        onClick={() => void signInAsPilot()}
        disabled={busy}
        data-testid="pilot-login"
      >
        {busy ? 'Signing in…' : 'Pilot learner sign-in (dev only)'}
      </button>
      {error && <p className="login-error">{error}</p>}
    </div>
  );
}

export default function GoogleSignInPage() {
  const pathname = window.location.pathname;
  const role = resolveRole(pathname);
  const url = new URL(window.location.href);
  const next = resolveNext(role);
  const eyebrow = resolveEyebrow(role);
  const lede = resolveLede(role);
  const testId = resolveTestId(pathname);

  // Intent resolved under the hood for the backend create-or-sign-in:
  //   - learner / new → 'new' (never 404 on a first-time Gmail).
  //   - admin / pm     → honor explicit ?intent=new, else 'existing'.
  const intent: 'existing' | 'new' =
    role === 'new' || role === 'learner'
      ? 'new'
      : url.searchParams.get('intent') === 'new'
        ? 'new'
        : 'existing';

  return (
    <main className="nt-entry" id="main" data-testid={testId}>
      <section className="nt-entry-shell nt-signin-shell" aria-labelledby="signin-heading">
        <div className="nt-entry-panel nt-signin-panel">
          <header className="nt-entry__hero">
            <p className="nt-section-eyebrow">{eyebrow}</p>
            <h1 id="signin-heading" className="nt-entry__title nt-signin__title">
              Sign in to continue
            </h1>
            <p className="nt-entry__lede">{lede}</p>
          </header>

          <div className="nt-signin-action">
            <GoogleSignInButton role={role} intent={intent} redirectAfter={next} />
            {role === 'learner' && <GuestOnlyButton />}
            {role === 'learner' && pilotLoginEnabled() && <PilotLoginButton />}
          </div>

          <footer className="nt-signin-foot">
            <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
              ← Back
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}
