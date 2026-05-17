import { useEffect, useState } from 'react';

interface GoogleStatus {
  configured: boolean;
  supabaseUrl: string | null;
  anonKeyConfigured: boolean;
}

interface Props {
  // Persisted into the OAuth redirect_to URL so the callback handler
  // can mint a JWT with the right entry flow + land the user on the
  // right post-login page.
  //   'admin' — pre-tagged admin intent (/admin/login).
  //   'developer' / 'student' — pre-tagged dev/student intent.
  //   'unspecified' — legacy single-button path; kept for the type
  //     signature but no longer used by any caller.
  role: 'developer' | 'student' | 'admin' | 'unspecified';
  // 'existing' = user expects to find an account; backend will 404 if
  //   no matching membership exists. 'new' = backend creates whatever
  //   the role needs (org for admin, plain user for developer). Default
  //   is 'existing' since most clicks are returning users.
  intent?: 'existing' | 'new';
  // Where to send the user once Google sign-in succeeds.
  redirectAfter?: string;
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
export default function GoogleSignInButton({ role, intent, redirectAfter }: Props) {
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
    const defaultAfter = role === 'student'
      ? '/student-learning'
      : role === 'admin'
        ? '/admin'
        : role === 'unspecified'
          ? '/'
          : '/studio';
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
        {busy
          ? 'Redirecting…'
          : role === 'unspecified'
            ? 'Continue with Google'
            : 'Sign in with Google'}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-helper">
        We use Google sign-in to verify your account. CodiNeo
        receives only your name and email.
      </p>
    </div>
  );
}
