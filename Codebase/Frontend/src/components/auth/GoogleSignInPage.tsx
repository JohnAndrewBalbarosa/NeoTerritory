import { useState } from 'react';
import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';

// Step 2 of the sign-in flow. Role is already decided by /auth/choose
// (or the user came in via a direct URL). This page asks the
// new/existing question — the answer determines whether the backend
// will look up an existing membership (existing) or set one up (new).

export default function GoogleSignInPage() {
  const path = window.location.pathname;
  const url = new URL(window.location.href);
  const role: 'developer' | 'student' | 'admin' =
    path.startsWith('/student-learning/login')
      ? 'student'
      : path.startsWith('/admin/login')
        ? 'admin'
        : 'developer';
  const next =
    role === 'student' ? '/student-learning' : role === 'admin' ? '/admin' : '/studio';
  const eyebrow =
    role === 'student'
      ? 'Student learning'
      : role === 'admin'
        ? 'PM / admin access'
        : 'Developer access';
  const lede =
    role === 'student'
      ? 'Your progress through the learning path is tied to your Google account.'
      : role === 'admin'
        ? 'PMs / admins manage an organization at pattern catalogs. Original-devs land sa NeoTerritory admin; iba ay automatic self-serve org.'
        : 'Your analysis runs at saved history are tied to your Google account.';
  const testId =
    role === 'admin' ? 'admin-login' : role === 'student' ? 'student-login' : 'developer-login';

  // Default to "existing" — most clicks are returning users. The
  // "Sign up instead" CTA on the callback error page sends ?intent=new
  // so users who get bounced for "no account" land here with the
  // correct radio already pre-selected.
  const initialIntent: 'existing' | 'new' =
    url.searchParams.get('intent') === 'new' ? 'new' : 'existing';
  const [intent, setIntent] = useState<'existing' | 'new'>(initialIntent);

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

          {role !== 'student' && (
            <fieldset className="nt-signin-intent" data-testid={`${testId}-intent`}>
              <legend className="nt-signin-intent__legend">Bago ba o existing account?</legend>
              <label className="nt-signin-intent__option">
                <input
                  type="radio"
                  name="intent"
                  value="existing"
                  checked={intent === 'existing'}
                  onChange={() => setIntent('existing')}
                />
                <span className="nt-signin-intent__label">
                  <strong>I already have an account</strong>
                  <span>Sign in and route me sa{role === 'admin' ? ' /admin' : ' /studio'}.</span>
                </span>
              </label>
              <label className="nt-signin-intent__option">
                <input
                  type="radio"
                  name="intent"
                  value="new"
                  checked={intent === 'new'}
                  onChange={() => setIntent('new')}
                />
                <span className="nt-signin-intent__label">
                  <strong>I&rsquo;m new here</strong>
                  <span>
                    {role === 'admin'
                      ? 'Set up my organization on first sign-in.'
                      : 'Create a developer account so I can save runs.'}
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className="nt-signin-action">
            <GoogleSignInButton role={role} intent={intent} redirectAfter={next} />
          </div>

          <footer className="nt-signin-foot">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate('/auth/choose')}
            >
              ← Back to role choice
            </button>
            <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
              Homepage
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}
