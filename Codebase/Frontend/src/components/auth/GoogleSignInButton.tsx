import { useEffect, useState } from 'react';
import { resolveLearnerLanding } from '../../logic/learnerRouting';
import { useAppStore } from '../../store/appState';

interface GoogleStatus {
  configured: boolean;
  supabaseUrl: string | null;
  anonKeyConfigured: boolean;
}

interface Props {
  // Persisted into the OAuth redirect_to URL so the callback handler
  // can mint a JWT with the right entry flow + land the user on the
  // right post-login page.
  //   'learner'   — unified developer+student learning intent.
  //   'admin'     — original-devs allowlist tier (/admin/login).
  //   'pm'        — self-serve org owner (/pm/login).
  //   'developer' / 'student' — legacy aliases for 'learner', kept for the
  //     type signature; the learner target resolves to pre-test or the learning path depending on session state.
  //   'new'       — first-timer; backend routes to /onboarding/choose.
  //   'unspecified' — legacy single-button path; kept for the type
  //     signature but no longer used by any caller.
  role: 'learner' | 'developer' | 'student' | 'admin' | 'pm' | 'new' | 'unspecified';
  // 'existing' = user expects to find an account; backend will 404 if
  //   no matching membership exists. 'new' = backend creates whatever
  //   the role needs (org for admin/pm, plain user for developer).
  //   Default is 'existing' since most clicks are returning users.
  intent?: 'existing' | 'new';
  // Where to send the user once Google sign-in succeeds.
  redirectAfter?: string;
  // Optional override for the small privacy note under the button.
  helperText?: string;
}

/**
 * Sign-in-with-Google button for the developer + student-learning
 * entry flows. The tester flow keeps using the Devcon seat picker —
 * this button is real-account only.
 *
 * Hides itself when /auth/google/status reports Supabase isn't
 * configured (locally or on the deployed backend). Avoids a dead
 * button in environments where Supabase auth hasn't been provisioned.
 */
export default function GoogleSignInButton({ role, intent, redirectAfter, helperText }: Props) {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/auth/google/status', { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((s: GoogleStatus) => setStatus(s))
      .catch(() => setStatus({ configured: false, supabaseUrl: null, anonKeyConfigured: false }));
  }, []);

  function startSignIn(): void {
    if (!status?.configured || !status.supabaseUrl) return;
    setBusy(true);
    setError(null);
    const defaultAfter =
      role === 'admin' || role === 'pm'
        ? '/admin'
        : role === 'new'
          ? '/onboarding/choose'
          : role === 'unspecified'
            ? '/'
            : resolveLearnerLanding(preTestCompleted);
    const after = redirectAfter || defaultAfter;
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('role', role);
    callback.searchParams.set('next', after);
    callback.searchParams.set('intent', intent ?? 'existing');
    const oauthUrl = `${status.supabaseUrl.replace(/\/+$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callback.toString())}`;
    // Full-page redirect — Supabase + Google handle the round-trip and
    // bounce back to /auth/callback with the session in the URL fragment.
    window.location.assign(oauthUrl);
  }

  if (!status) {
    return (
      <button type="button" className="ghost-btn" disabled aria-busy="true">
        Checking sign-in availability…
      </button>
    );
  }

  if (!status.configured) {
    return (
      <p className="auth-disabled-hint" role="status">
        Google sign-in is not configured on this server. Use the Tester
        path for now, or ask the project owner to enable Supabase auth.
      </p>
    );
  }

  return (
    <div className="google-signin">
      <button
        type="button"
        className="primary-btn google-signin__btn"
        onClick={startSignIn}
        disabled={busy}
      >
        {!busy && (
          <span className="google-signin__glyph" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" focusable="false">
              <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.76-2.11-6.7-4.94H1.29v3.09A11.997 11.997 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.31a7.19 7.19 0 0 1 0-4.62V6.6H1.29a12 12 0 0 0 0 10.8l4.01-3.09z" />
              <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.6l4.01 3.09C6.24 6.86 8.88 4.75 12 4.75z" />
            </svg>
          </span>
        )}
        <span>
          {busy
            ? 'Redirecting…'
            : role === 'unspecified'
              ? 'Continue with Google'
              : 'Sign in with Google'}
        </span>
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-helper">
        {helperText ?? 'CodiNeo only receives your name and email for progress tracking.'}
      </p>
    </div>
  );
}
