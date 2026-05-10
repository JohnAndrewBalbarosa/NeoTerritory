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
      <section className="nt-entry-shell" aria-labelledby="signin-heading">
        <div className="nt-entry-panel" style={{ maxWidth: '480px', textAlign: 'center', padding: '4rem 2rem' }}>
          <p className="nt-section-eyebrow">
            {role === 'student' ? 'Student learning' : 'Developer access'}
          </p>
          <h1 id="signin-heading" className="nt-entry__title" style={{ marginBottom: '0.75rem' }}>
            Sign in to continue
          </h1>
          <p className="nt-entry__lede" style={{ marginBottom: '2rem' }}>
            {role === 'student'
              ? 'Your progress through the learning path is tied to your Google account.'
              : 'Documentation runs and saved analyses are tied to your Google account.'}
          </p>
          <GoogleSignInButton role={role} redirectAfter={next} />
          <div style={{ marginTop: '2rem' }}>
            <button type="button" className="ghost-btn" onClick={() => navigate('/choose')}>
              Back to entry choices
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
