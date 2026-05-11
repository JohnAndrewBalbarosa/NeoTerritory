import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';

/**
 * Standalone Google sign-in page used by both /developer/login and
 * /student-learning/login. Reads the role from the path so we don't
 * need a prop.
 */
export default function GoogleSignInPage() {
  const role: 'developer' | 'student' =
    window.location.pathname.startsWith('/student-learning/login') ? 'student' : 'developer';
  const next = role === 'student' ? '/student-learning' : '/studio';

  return (
    <main className="nt-entry" id="main">
      <section className="nt-entry-shell nt-signin-shell" aria-labelledby="signin-heading">
        <div className="nt-entry-panel nt-signin-panel">
          <header className="nt-entry__hero">
            <p className="nt-section-eyebrow">
              {role === 'student' ? 'Student learning' : 'Developer access'}
            </p>
            <h1 id="signin-heading" className="nt-entry__title nt-signin__title">
              Sign in to continue
            </h1>
            <p className="nt-entry__lede">
              {role === 'student'
                ? 'Your progress through the learning path is tied to your Google account.'
                : 'Documentation runs and saved analyses are tied to your Google account.'}
            </p>
          </header>
          <div className="nt-signin-action">
            <GoogleSignInButton role={role} redirectAfter={next} />
          </div>
          <footer className="nt-signin-foot">
            <button type="button" className="ghost-btn" onClick={() => navigate('/choose')}>
              Back to entry choices
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}
