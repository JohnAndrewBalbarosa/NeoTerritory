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
  if (role === 'student') return '/patterns/learn';
  if (role === 'admin' || role === 'pm') {
    // /admin is gated by ADMIN_GATE_KEY on the backend. Append the key
    // (injected at build time via VITE_ADMIN_GATE_KEY) so the post-OAuth
    // redirect lands directly on the dashboard. When the env var is
    // absent the gate is unenforced and /admin serves normally.
    const key = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADMIN_GATE_KEY;
    return key ? `/admin?key=${encodeURIComponent(key)}` : '/admin';
  }
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
    return 'For NeoTerritory original developers (Andrew / Miryl / Josephine) only. Other emails are redirected to PM sign-in.';
  }
  if (role === 'pm') {
    return 'Manage your own organization and pattern catalogs. New PMs get a fresh org on first sign-in.';
  }
  if (role === 'new') {
    return 'Sign in with Google. Afterwards, the onboarding wizard will ask whether you are an admin or a developer.';
  }
  return 'Your analysis runs and saved history are tied to your Google account.';
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

  // The visible "I already have an account / I'm new here" toggle was
  // removed per the project owner (it isn't part of the thesis paper). The
  // page now shows only the single "Sign in with Google" button. We still
  // resolve an intent under the hood so the backend can create-or-sign-in:
  //   - developer / new  → 'new', the create-or-sign-in upsert (a first-time
  //     Gmail is auto-registered; a returning email is matched). This is the
  //     public Account path, so it must never 404 on a new user.
  //   - admin / pm        → honor an explicit ?intent=new deep-link, else
  //     default to 'existing' (returning-operator behavior preserved).
  //   - student           → 'existing' (the backend upserts students without
  //     the existing-account 404 gate anyway).
  const intent: 'existing' | 'new' =
    role === 'new' || role === 'developer'
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
          </div>

          <footer className="nt-signin-foot">
            {/* Single Back control that returns to the homepage. The old
                two-button footer (Back to role choice / Homepage) pointed at
                the retired /auth/choose surface; one clear [Back] → / is all
                this page needs. */}
            <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
              ← Back
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}
