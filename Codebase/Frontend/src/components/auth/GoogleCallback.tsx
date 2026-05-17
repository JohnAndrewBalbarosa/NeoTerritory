import { useEffect, useState } from 'react';
import { navigate, replaceUrl } from '../../logic/router';
import RoleChooserModal from './RoleChooserModal';

const TOKEN_KEY = 'nt_token';

interface ExchangeResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string;
    orgId?: string | null;
    isOriginalDevs?: boolean;
  };
  entryFlow: 'developer' | 'student' | 'admin' | 'unspecified';
  orgCreated?: boolean;
  wasNew?: boolean;
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

export default function GoogleCallback() {
  const [phase, setPhase] = useState<'verifying' | 'success' | 'rolePrompt' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tokenForPrompt, setTokenForPrompt] = useState<string | null>(null);
  const [pendingNext, setPendingNext] = useState<string>('/studio');

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const queryRole = url.searchParams.get('role');
    const role: 'developer' | 'student' | 'admin' | 'unspecified' =
      queryRole === 'student'
        ? 'student'
        : queryRole === 'admin' || queryRole === 'pm'
          ? 'admin'
          : queryRole === 'unspecified' || queryRole === '' || queryRole === null
            ? 'unspecified'
            : 'developer';
    const defaultNext =
      role === 'student'
        ? '/student-learning'
        : role === 'admin'
          ? '/admin'
          : role === 'unspecified'
            ? '/' // will be overridden after the role prompt resolves
            : '/studio';
    const next = url.searchParams.get('next') || defaultNext;

    if (!accessToken) {
      setPhase('error');
      setErrorMsg(fragment.get('error_description') || 'No access_token in callback URL.');
      return;
    }

    fetch('/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ accessToken, role }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Exchange failed (${r.status})`);
        }
        return r.json() as Promise<ExchangeResponse>;
      })
      .then((data) => {
        localStorage.setItem(TOKEN_KEY, data.token);
        try {
          window.sessionStorage.setItem('nt-entry-flow', data.entryFlow);
        } catch {
          /* ignore */
        }
        // Brand-new (or role-unset) unified sign-ins → show the role
        // prompt. The prompt commits via /auth/google/finalize-role and
        // re-mints the JWT before we route.
        if (data.promptRoleChoice) {
          setTokenForPrompt(data.token);
          setPendingNext(next);
          setPhase('rolePrompt');
          return;
        }
        // Returning user OR explicit role tag (admin/developer/student) →
        // resolve next from the response so admin lands sa /admin even
        // if the URL param said something else.
        const resolvedNext =
          data.user.orgId && data.entryFlow === 'admin'
            ? '/admin'
            : next;
        setPhase('success');
        landAt(resolvedNext);
      })
      .catch((err: Error) => {
        setPhase('error');
        setErrorMsg(err.message || 'Sign-in failed.');
      });
  }, []);

  function onRoleChosen(result: {
    token: string;
    role: 'admin' | 'developer';
    orgId: string | null;
    isOriginalDevs: boolean;
  }): void {
    localStorage.setItem(TOKEN_KEY, result.token);
    try {
      window.sessionStorage.setItem('nt-entry-flow', result.role);
    } catch {
      /* ignore */
    }
    setPhase('success');
    const next = result.role === 'admin' ? '/admin' : '/studio';
    landAt(next);
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
            {phase === 'rolePrompt' && (
              <>
                <h1 className="nt-entry__title nt-signin__title">Almost done</h1>
                <p className="nt-entry__lede">
                  Pick how you&rsquo;ll use CodiNeo to finish setting up your account.
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
                <p className="nt-entry__lede" role="alert">{errorMsg}</p>
              </>
            )}
          </header>
          {phase === 'error' && (
            <footer className="nt-signin-foot">
              <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
                Back to homepage
              </button>
            </footer>
          )}
        </div>
        {/* Suppress unused-state warning for pendingNext when not in rolePrompt. */}
        {phase === 'rolePrompt' && tokenForPrompt && (
          <RoleChooserModal
            bearerToken={tokenForPrompt}
            onChosen={(r) => {
              void pendingNext; // keep ref so lint doesn't flag the state
              onRoleChosen(r);
            }}
          />
        )}
      </section>
    </main>
  );
}
