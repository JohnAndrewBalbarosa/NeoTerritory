import { useState } from 'react';
import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';

// Step 2 of the sign-in flow. Role is decided by /auth/choose (or the
// user came in via a direct URL). This page asks new-vs-existing — the
// answer determines whether the backend looks up an existing membership
// (existing) or sets one up (new). For 'new' role, intent is forced to
// 'new' since the path is explicitly the onboarding wizard.

type Role = 'developer' | 'student' | 'admin' | 'pm' | 'new';

function resolveRole(pathname: string): Role {
  if (pathname.startsWith('/student-learning/login')) return 'student';
  if (pathname.startsWith('/admin/login')) return 'admin';
  if (pathname.startsWith('/pm/login')) return 'pm';
  if (pathname.startsWith('/new-user/login')) return 'new';
  return 'developer';
}

function resolveNext(role: Role): string {
  if (role === 'student') return '/student-learning';
  if (role === 'admin' || role === 'pm') return '/admin';
  if (role === 'new') return '/onboarding/choose';
  return '/studio';
}

function resolveEyebrow(role: Role): string {
  if (role === 'student') return 'Student learning';
  if (role === 'admin') return 'Super admin access';
  if (role === 'pm') return 'Project manager access';
  if (role === 'new') return 'First-time setup';
  return 'Developer access';
}

function resolveLede(role: Role): string {
  if (role === 'student') {
    return 'Your progress through the learning path is tied to your Google account.';
  }
  if (role === 'admin') {
    return 'For NeoTerritory original-devs (Andrew / Miryl / Josephine) only. Other emails ay ire-redirect sa PM sign-in.';
  }
  if (role === 'pm') {
    return 'Mag-manage ng sariling organization at pattern catalogs. New PMs get a fresh org on first sign-in.';
  }
  if (role === 'new') {
    return 'Sign in with Google. Pagkatapos, tatanungin ka kung admin ka ba o developer sa onboarding wizard.';
  }
  return 'Your analysis runs at saved history are tied to your Google account.';
}

function resolveTestId(role: Role): string {
  if (role === 'admin') return 'admin-login';
  if (role === 'student') return 'student-login';
  if (role === 'pm') return 'pm-login';
  if (role === 'new') return 'new-user-login';
  return 'developer-login';
}

export default function GoogleSignInPage() {
  const role = resolveRole(window.location.pathname);
  const url = new URL(window.location.href);
  const next = resolveNext(role);
  const eyebrow = resolveEyebrow(role);
  const lede = resolveLede(role);
  const testId = resolveTestId(role);

  // Default to "existing" — most clicks are returning users. The
  // "Sign up instead" CTA on the callback error page sends ?intent=new.
  // For role='new', intent is locked to 'new' since the path is the
  // onboarding wizard by definition.
  const initialIntent: 'existing' | 'new' =
    role === 'new'
      ? 'new'
      : url.searchParams.get('intent') === 'new'
        ? 'new'
        : 'existing';
  const [intent, setIntent] = useState<'existing' | 'new'>(initialIntent);

  const showIntentToggle = role !== 'student' && role !== 'new';

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

          {showIntentToggle && (
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
                  <span>
                    Sign in and route me sa
                    {role === 'admin' || role === 'pm' ? ' /admin' : ' /studio'}.
                  </span>
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
                    {role === 'admin' || role === 'pm'
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
