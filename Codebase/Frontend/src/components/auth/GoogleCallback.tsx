import { useEffect, useRef, useState } from 'react';
import { navigate, replaceUrl } from '../../logic/router';
import { useAppStore } from '../../store/appState';
import type { User } from '../../types/api';

// Post-OAuth callback. Drives the entire decision tree:
//
//   1. Verify the access_token with the backend (POSTs to /auth/google/exchange).
//   2. Persist BOTH nt_token AND nt_user via useAppStore.setAuth so the
//      admin SPA can boot pre-authenticated (its store reads nt_user at
//      module init — missing that key = legacy login form re-prompt).
//   3. Decide destination SYNCHRONOUSLY inside the same .then callback
//      so React never re-renders with an intermediate "/studio" target.
//      The previous version called setPhase('success') BEFORE landAt;
//      because landAt does window.location.assign for /admin, the page
//      began unloading mid-render and users sometimes saw a flash on
//      stale bundles where the routing branch lived. Now there is no
//      'success' phase render at all — the browser navigation is the
//      transition.
//   4. For /admin → window.location.assign (full-page nav so admin.html
//      Vite bundle loads). For everything else → replaceUrl (SPA route).

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
  entryFlow: 'developer' | 'student' | 'admin' | 'pm' | 'new' | 'unspecified';
  orgCreated?: boolean;
  wasNew?: boolean;
  needsOnboarding?: boolean;
}

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

// Resolve the final destination from the exchange response. Pure: no
// React state, no side effects. Called once inside the .then callback
// and stashed on a ref so the navigation source-of-truth is the
// backend response, never an intermediate URL param.
function resolveDestination(
  data: ExchangeResponse,
  fallback: string,
): string {
  // New-user role + backend says needs onboarding → wizard.
  if (data.entryFlow === 'new' || data.needsOnboarding === true) {
    return '/onboarding/choose';
  }
  // Admin tier (original-devs OR any user with explicit admin role +
  // resolved org) → admin SPA.
  if (
    data.user.isOriginalDevs === true ||
    data.user.role === 'admin' ||
    ((data.entryFlow === 'admin' || data.entryFlow === 'pm') && data.user.orgId)
  ) {
    return '/admin';
  }
  return fallback;
}

export default function GoogleCallback() {
  const setAuth = useAppStore((s) => s.setAuth);
  const [phase, setPhase] = useState<'verifying' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCanSignUp, setErrorCanSignUp] = useState<{ role: 'admin' | 'developer' | 'pm' } | null>(null);
  // Ref to lock the destination once resolved. Prevents any stale URL
  // `next` param from leaking into the navigation between the fetch
  // resolve and the actual browser nav.
  const destinationRef = useRef<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const queryRole = url.searchParams.get('role');
    const queryIntent = url.searchParams.get('intent');
    const role: 'developer' | 'student' | 'admin' | 'pm' | 'new' =
      queryRole === 'student'
        ? 'student'
        : queryRole === 'admin'
          ? 'admin'
          : queryRole === 'pm'
            ? 'pm'
            : queryRole === 'new' || queryRole === 'new-user'
              ? 'new'
              : 'developer';
    const intent: 'existing' | 'new' = queryIntent === 'new' ? 'new' : 'existing';
    const defaultNext =
      role === 'student'
        ? '/student-learning'
        : role === 'admin' || role === 'pm'
          ? '/admin'
          : role === 'new'
            ? '/onboarding/choose'
            : '/studio';
    const fallbackNext = url.searchParams.get('next') || defaultNext;

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
            allowed?: boolean;
            attemptedRole?: 'admin' | 'developer' | 'pm';
          };
          err.status = r.status;
          err.existing = body.existing === false ? false : undefined;
          err.allowed = body.allowed === false ? false : undefined;
          err.attemptedRole =
            role === 'admin' ? 'admin' : role === 'pm' ? 'pm' : 'developer';
          throw err;
        }
        return body as ExchangeResponse;
      })
      .then((data) => {
        // SYNCHRONOUS routing: persist auth, lock destination, navigate.
        // No setPhase('success') interstitial — the browser nav IS the
        // transition. This kills the studio-flash class of bugs at the
        // source by removing the intermediate render window entirely.
        setAuth(data.token, exchangeUserToStored(data.user));
        try {
          window.sessionStorage.setItem('nt-entry-flow', data.entryFlow);
        } catch {
          /* ignore */
        }
        destinationRef.current = resolveDestination(data, fallbackNext);
        landAt(destinationRef.current);
      })
      .catch((err: Error & { status?: number; existing?: boolean; allowed?: boolean; attemptedRole?: 'admin' | 'developer' | 'pm' }) => {
        setPhase('error');
        setErrorMsg(err.message || 'Sign-in failed.');
        if (err.status === 404 && err.existing === false && err.attemptedRole) {
          setErrorCanSignUp({ role: err.attemptedRole });
        }
        // 403 + allowed=false from admin gate → push them to PM path.
        if (err.status === 403 && err.allowed === false) {
          setErrorCanSignUp({ role: 'pm' });
        }
      });
  }, [setAuth]);

  function signUpInstead(): void {
    if (!errorCanSignUp) return;
    const target =
      errorCanSignUp.role === 'admin'
        ? '/admin/login'
        : errorCanSignUp.role === 'pm'
          ? '/pm/login'
          : '/developer/login';
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
                <p className="nt-entry__lede" role="status">
                  Verifying your Google session with CodiNeo, then routing you to
                  the right page&hellip;
                </p>
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
                  {errorCanSignUp.role === 'pm'
                    ? 'Switch to PM sign-in instead →'
                    : `Sign up as ${errorCanSignUp.role} instead →`}
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
