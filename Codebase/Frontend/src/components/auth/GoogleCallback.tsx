import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';

const TOKEN_KEY = 'nt_token';

interface ExchangeResponse {
  token: string;
  user: { id: number; username: string; email: string | null; role: string };
  entryFlow: 'developer' | 'student';
}

/**
 * Handles the redirect-back from Supabase / GoTrue after Google sign-in.
 *
 * GoTrue puts the session in the URL fragment as
 *   #access_token=...&refresh_token=...&type=...&expires_in=...
 * Fragments never reach the server, so we parse it client-side, hand
 * the access_token to /auth/google/exchange (which verifies it
 * against Supabase /auth/v1/user, upserts a local users row, and mints
 * our app JWT), then store the resulting JWT exactly like the existing
 * username/password login path and navigate to the requested next page.
 */
export default function GoogleCallback() {
  const [phase, setPhase] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const queryRole = url.searchParams.get('role');
    const role: 'developer' | 'student' = queryRole === 'student' ? 'student' : 'developer';
    const next = url.searchParams.get('next') || (role === 'student' ? '/student-learning' : '/studio');

    if (!accessToken) {
      setPhase('error');
      setErrorMsg(fragment.get('error_description') || 'No access_token in callback URL.');
      return;
    }

    fetch('/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ accessToken, role })
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
        // Stash the entry flow so MainLayout can branch developer vs
        // student rendering without a second backend round trip.
        try { window.sessionStorage.setItem('nt-entry-flow', data.entryFlow); } catch { /* ignore */ }
        // Strip the fragment so a back-button + replay doesn't try to
        // re-exchange the (now-stale) Supabase token.
        window.history.replaceState(null, '', next);
        setPhase('success');
        navigate(next);
      })
      .catch((err: Error) => {
        setPhase('error');
        setErrorMsg(err.message || 'Sign-in failed.');
      });
  }, []);

  return (
    <main className="nt-entry" id="main">
      <section className="nt-entry-shell" aria-live="polite">
        <div className="nt-entry-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          {phase === 'verifying' && (
            <>
              <h1>Signing you in…</h1>
              <p>Verifying your Google session with NeoTerritory.</p>
            </>
          )}
          {phase === 'success' && (
            <>
              <h1>Signed in</h1>
              <p>Redirecting…</p>
            </>
          )}
          {phase === 'error' && (
            <>
              <h1>Sign-in failed</h1>
              <p>{errorMsg}</p>
              <button type="button" className="ghost-btn" onClick={() => navigate('/choose')}>
                Back to entry choices
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
