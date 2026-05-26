import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import StudioJoyrideTour, { dispatchStudioTourOpen } from '../studio/StudioJoyrideTour';
import SignoutSurvey from '../survey/SignoutSurvey';
import StudioSurface from '../studio/StudioSurface';

// Standalone studio shell: the topbar chrome (brand, theme, tour, sign-out)
// wrapped around the reusable StudioSurface (the Submit → Patterns → Tests
// tab strip). The analysis surface itself lives in StudioSurface so it can
// also be embedded — chrome-less — inside the Learning Path practicals.
//
// Reachable only by admins now; learners run the studio inside the practical
// wrapper. The redirect for non-admins lives in StudioApp.
export default function MainLayout() {
  // Ensure the studio shell always lands at viewport top on mount.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Dev-only viewport overflow detector for the studio shell.
  useOverflowGuard({ rootSelector: '.shell', tolerancePx: 2 });
  const { theme, toggleTheme } = useTheme();
  const {
    user, sessionRanAnalyze, sessionReviewedEnd,
    token, status, reviewsRequired,
  } = useAppStore();

  const { signOut } = useAuth();

  const [showSignout, setShowSignout] = useState(false);

  function onSignOutClick() {
    // The sign-out survey is a tester-research instrument. Non-tester users
    // (developers, admins, real learners) bypass it. It is also gated on
    // reviewsRequired so turning the survey off removes the whole feedback
    // workflow.
    const isTester = (user?.username || '').toLowerCase().startsWith('devcon');
    if (reviewsRequired && isTester && sessionRanAnalyze && !sessionReviewedEnd && token) {
      setShowSignout(true);
      return;
    }
    signOut();
  }

  function onSignoutComplete() {
    useAppStore.getState().setSessionReviewedEnd(true);
    setShowSignout(false);
    signOut();
  }

  // Normalize the URL to /studio so the address bar reflects the surface.
  if (token && user && typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path !== '/studio' && path !== '/admin.html') {
      window.history.replaceState(null, '', '/studio');
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">CodiNeo Studio</p>
          <h1 className="brand-title">Pattern detection &amp; annotation</h1>
          <p className="lede">
            Paste C++ source or upload a file. The microservice detects design patterns
            and the studio shows comments side-by-side with the lines they reference.
          </p>
        </div>
        <div id="status-card" className="status-card status-card--slim">
          {/* Screen-reader + Playwright status hook. */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            <strong id="status-title" data-testid="status-title">{status?.title ?? ''}</strong>
            <span id="status-detail" data-testid="status-detail">{status?.detail ?? ''}</span>
          </div>
          <div id="user-row" className="user-row">
            <span id="user-label">{user?.username ?? ''}</span>
            <button
              className="ghost-btn theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
            <button
              className="ghost-btn"
              type="button"
              title="Replay the studio tour"
              aria-label="Replay the studio tour"
              onClick={() => dispatchStudioTourOpen()}
            >
              ? Tour
            </button>
            <button id="logout-btn" className="ghost-btn" type="button" onClick={onSignOutClick}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <StudioJoyrideTour />

      <StudioSurface />

      {showSignout && (
        <SignoutSurvey
          onComplete={onSignoutComplete}
          onCancel={() => setShowSignout(false)}
        />
      )}
    </div>
  );
}
