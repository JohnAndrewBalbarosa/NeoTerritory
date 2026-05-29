import { useState } from 'react';
import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';
import { useAppStore } from '../../store/appState';
import { fetchTesterAccounts, claimSeat, fetchRuns, fetchSample } from '../../api/client';
import type { User } from '../../types/api';

// Sign-in page. After the learner-merge, the former 'developer' and 'student'
// entry flows are unified into a single 'learner' role: both /developer/login
// and /student-learning/login land here, sign in with Google, and route to
// /patterns/learn. admin / pm / new keep their own behaviour.
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
  if (role === 'learner') return '/patterns/learn';
  if (role === 'admin' || role === 'pm') {
    const key = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADMIN_GATE_KEY;
    return key ? `/admin?key=${encodeURIComponent(key)}` : '/admin';
  }
  return '/onboarding/choose';
}

function resolveEyebrow(role: Role): string {
  if (role === 'learner') return 'Learner access';
  if (role === 'admin') return 'Super admin access';
  if (role === 'pm') return 'Project manager access';
  return 'First-time setup';
}

function resolveLede(role: Role): string {
  if (role === 'learner') {
    return 'Sign in with Google to save your progress through the learning path, or continue as a guest for a one-time look.';
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
      navigate('/patterns/learn');
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
        {busy ? 'Starting guest session…' : 'Use guest only (no saved progress)'}
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
