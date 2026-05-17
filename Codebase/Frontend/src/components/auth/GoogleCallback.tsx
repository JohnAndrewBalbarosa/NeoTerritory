import { useEffect, useState } from 'react';
import { navigate, replaceUrl } from '../../logic/router';
import { useAppStore } from '../../store/appState';
import type { User } from '../../types/api';

// Persisted via the appState store's setAuth so BOTH nt_token and
// nt_user end up in localStorage (the admin SPA reads nt_user at boot
// — without it, AdminApp's gate `if (!user)` falls through to the
// legacy login form and the user gets prompted to sign in a second
// time).

interface ExchangeUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  orgId?: string | null;
  isOriginalDevs?: boolean;
}

interface ExchangeResponse {
  token: string;
  user: ExchangeUser;
  entryFlow: 'developer' | 'student' | 'admin' | 'unspecified';
  orgCreated?: boolean;
  wasNew?: boolean;
  // Legacy field from the old single-button flow; ignored after the
  // pre-OAuth role + new/existing redesign.
  promptRoleChoice?: boolean;
}

// Decide where to land after auth. Admin requires a full-page nav
// because the admin SPA is a separate Vite bundle (admin.html), not a
// surface the main router knows about — an in-SPA replaceUrl('/admin')
// would render the marketing hero. Everything else stays in the SPA.
function landAt(next: string): void {
  if (next === '/admin' || next.startsWith('/admin/')) {
    window.location.assign(next);
    return;
  }
  replaceUrl(next);
}

function exchangeUserToStored(user: ExchangeUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    role: user.role === 'admin' ? 'admin' : 'user',
    orgId: user.orgId ?? null,
    isOriginalDevs: user.isOriginalDevs === true,
  };
}

export default function GoogleCallback() {
  const setAuth = useAppStore((s) => s.setAuth);
  const [phase, setPhase] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCanSignUp, setErrorCanSignUp] = useState<{ role: 'admin' | 'developer' } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const queryRole = url.searchParams.get('role');
    const queryIntent = url.searchParams.get('intent');
    const role: 'developer' | 'student' | 'admin' =
      queryRole === 'student'
        ? 'student'
        : queryRole === 'admin' || queryRole === 'pm'
          ? 'admin'
          : 'developer';
    const intent: 'existing' | 'new' = queryIntent === 'new' ? 'new' : 'existing';
    const defaultNext =
      role === 'student' ? '/student-learning' : role === 'admin' ? '/admin' : '/studio';
    const next = url.searchParams.get('next') || defaultNext;

    if (!accessToken) {
      setPhase('error');
      setErrorMsg(fragment.get('error_description') || 'No access_token in callback URL.');
      return;
    }

    fetch('/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ accessToken, role, intent }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          const err = new Error(body.error || `Exchange failed (${r.status})`) as Error & {
            status?: number;
            existing?: boolean;
            attemptedRole?: 'admin' | 'developer';
          };
          err.status = r.status;
          err.existing = body.existing === false ? false : undefined;
          err.attemptedRole = role === 'admin' ? 'admin' : 'developer';
          throw err;
        }
        return body as ExchangeResponse;
      })
      .then((data) => {
        // Persist BOTH token AND user — admin SPA reads nt_user at boot.
        setAuth(data.token, exchangeUserToStored(data.user));
        try {
          window.sessionStorage.setItem('nt-entry-flow', data.entryFlow);
        } catch {
          /* ignore */
        }
        setPhase('success');
        // Auto-route. Original-devs and admin-role users go to the admin
        // bundle (full-page nav). Everyone else lands in the SPA.
        const goesToAdmin =
          data.user.isOriginalDevs === true ||
          data.user.role === 'admin' ||
          (data.entryFlow === 'admin' && data.user.orgId);
        landAt(goesToAdmin ? '/admin' : next);
      })
      .catch((err: Error & { status?: number; existing?: boolean; attemptedRole?: 'admin' | 'developer' }) => {
        setPhase('error');
        setErrorMsg(err.message || 'Sign-in failed.');
        // 404 + existing=false → backend told us there is no account
        // matching the chosen role. Offer a one-click switch to "new".
        if (err.status === 404 && err.existing === false && err.attemptedRole) {
          setErrorCanSignUp({ role: err.attemptedRole });
        }
      });
  }, [setAuth]);

  function signUpInstead(): void {
    if (!errorCanSignUp) return;
    const target = errorCanSignUp.role === 'admin' ? '/admin/login' : '/developer/login';
    // intent=new will be the default on the login page once the user
    // toggles it; for now drop a query hint the login page can honor.
    navigate(`${target}?intent=new`);
  }

  return (
    <main className="nt-entry" id="main">
      <section className="nt-entry-shell nt-signin-shell" aria-live="polite">
        <div className="nt-entry-panel nt-signin-panel">
          <header className="nt-entry__hero">
            <p className="nt-section-eyebrow">Google sign-in</p>
            {phase === 'verifying' && (
              <>
                <div className="nt-signin-spinner" aria-hidden="true" />
                <h1 className="nt-entry__title nt-signin__title">Signing you in</h1>
                <p className="nt-entry__lede">
                  Verifying your Google session with CodiNeo.
                </p>
              </>
            )}
            {phase === 'success' && (
              <>
                <h1 className="nt-entry__title nt-signin__title">Signed in</h1>
                <p className="nt-entry__lede">Redirecting you now…</p>
              </>
            )}
            {phase === 'error' && (
              <>
                <h1 className="nt-entry__title nt-signin__title">Sign-in failed</h1>
                <p className="nt-entry__lede" role="alert">
                  {errorMsg}
                </p>
              </>
            )}
          </header>
          {phase === 'error' && (
            <footer className="nt-signin-foot">
              {errorCanSignUp && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={signUpInstead}
                >
                  Sign up as {errorCanSignUp.role} instead →
                </button>
              )}
              <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
                Back to homepage
              </button>
            </footer>
          )}
        </div>
      </section>
    </main>
  );
}
