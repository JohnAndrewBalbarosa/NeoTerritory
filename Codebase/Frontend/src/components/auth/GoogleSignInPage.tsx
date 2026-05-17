import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';

/**
 * Standalone Google sign-in page used by both /developer/login and
 * /student-learning/login. Reads the role from the path so we don't
 * need a prop.
 */
export default function GoogleSignInPage() {
  const path = window.location.pathname;
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
        ? 'Project managers / admins sign in to manage their organization and pattern catalogs. If your email is the original-devs team, you land sa NeoTerritory admin; kung hindi, automatic self-serve org gets created for you.'
        : 'Documentation runs and saved analyses are tied to your Google account.';
  const testId =
    role === 'admin' ? 'admin-login' : role === 'student' ? 'student-login' : 'developer-login';

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
            <GoogleSignInButton role={role} redirectAfter={next} />
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
