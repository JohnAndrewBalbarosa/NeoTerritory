import { useEffect } from 'react';
import { useAppStore } from '../../store/appState';
import { navigate } from '../../logic/router';
import PatternsLearnPage from '../marketing/patterns/PatternsLearnPage';

// Standalone learner home. Lives outside MarketingShell so the homepage
// topbar / footer never bleed into the learning surface — the user wants
// /patterns/learn to feel like its own site. Sign-in is required so per-
// module progress can be persisted server-side (the persistence API is
// a follow-up; this shell is the gate that unlocks it).
export default function StudentLearningShell() {
  const { token, user, clearAuth } = useAppStore();

  useEffect(() => {
    if (!token) {
      navigate('/student-learning/login');
    }
  }, [token]);

  useEffect(() => {
    document.body.dataset.surface = 'studentLearningShell';
    window.scrollTo({ top: 0, behavior: 'auto' });
    return () => {
      delete document.body.dataset.surface;
    };
  }, []);

  if (!token) {
    return (
      <div
        className="nt-learn-shell nt-learn-shell--redirect"
        data-testid="student-learning-shell"
        data-state="redirect-to-login"
      >
        <p className="nt-learn-shell__redirect-msg">
          Redirecting to sign-in&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="nt-learn-shell" data-testid="student-learning-shell">
      <a href="#main" className="nt-skip-link">
        Skip to main content
      </a>
      <header className="nt-learn-shell__bar">
        <button
          type="button"
          className="nt-learn-shell__brand"
          onClick={() => navigate('/patterns/learn')}
          aria-label="CodiNeo Learning home"
        >
          <span className="nt-learn-shell__wordmark">CodiNeo</span>
          <span className="nt-learn-shell__divider" aria-hidden="true">/</span>
          <span className="nt-learn-shell__crumb">Learning</span>
        </button>
        <div className="nt-learn-shell__bar-right">
          {user?.email && (
            <span className="nt-learn-shell__email" title={user.email}>
              {user.email}
            </span>
          )}
          <button
            type="button"
            className="nt-learn-shell__signout"
            onClick={() => {
              clearAuth();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <PatternsLearnPage />
    </div>
  );
}
