import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { navigate } from '../../logic/router';
import { fetchLearningAssessments } from '../../api/client';
import { preTestPathForNext } from '../../logic/learnerRouting';
import { hasFreshSavedPretest } from '../../logic/pretestFreshness';
import PatternsLearnPage from '../marketing/patterns/PatternsLearnPage';

// Standalone learner home. Lives outside MarketingShell so the homepage
// topbar / footer never bleed into the learning surface — the user wants
// /patterns/learn to feel like its own site. Sign-in is required so per-
// module progress can be persisted server-side (the persistence API is
// a follow-up; this shell is the gate that unlocks it).
export default function StudentLearningShell() {
  const { token, user, clearAuth } = useAppStore();
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);
  const [pretestGate, setPretestGate] = useState<'checking' | 'fresh' | 'needs-pretest'>('checking');

  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => navigate('/student-learning/login'), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [token]);

  useEffect(() => {
    if (!token || !user?.id) {
      setPretestGate('checking');
      return;
    }

    let cancelled = false;
    setPretestGate('checking');

    fetchLearningAssessments()
      .then((data) => {
        if (cancelled) return;

        // For registered users, automatically skip the pre-test if already fresh.
        // Guests (shared Devcon seats) are allowed to re-take it to ensure their
        // ephemeral session feels independent from previous occupants.
        const state = useAppStore.getState();
        const user = state.user;
        const email = (user?.email || '').toLowerCase();
        const isGuest = !email || email.endsWith('@test.local') || email.endsWith('@guest.neoterritory.local');

        const fresh = isGuest ? state.preTestCompleted : hasFreshSavedPretest(data);
        setPreTestCompleted(fresh);
        setPretestGate(fresh ? 'fresh' : 'needs-pretest');
        if (!fresh) {
          const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          navigate(preTestPathForNext(next));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to verify pre-test freshness:', err);
        setPreTestCompleted(false);
        setPretestGate('needs-pretest');
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        navigate(preTestPathForNext(next));
      });

    return () => {
      cancelled = true;
    };
  }, [setPreTestCompleted, token, user?.id]);

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

  if (pretestGate !== 'fresh') {
    return (
      <div
        className="nt-learn-shell nt-learn-shell--redirect"
        data-testid="student-learning-shell"
        data-state={pretestGate === 'checking' ? 'checking-pretest' : 'redirecting-pretest'}
      >
        <p className="nt-learn-shell__redirect-msg">
          {pretestGate === 'checking'
            ? 'Checking pre-test status...'
            : 'Redirecting to pre-test...'}
        </p>
      </div>
    );
  }

  return (
    <div className="nt-learn-shell" data-testid="student-learning-shell">
      <a href="#main" className="nt-skip-link">
        Skip to main content
      </a>
      <header className="nt-learn-shell__bar nt-learn-shell__bar--learn">
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
        <h1 className="nt-learn-shell__title">Learning Path</h1>
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
