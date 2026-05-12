import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';

// Per D75 (this turn): two-step chooser.
//   Step 1: Learning module (open, no auth) OR Studio app.
//   Step 2 (only if user picked Studio): Tester seat (no account, devcon
//   pool) OR Account holder (sign in / register, progress saves).
// The "account holder saves progress" angle is a forward-looking pitch
// per user direction; both /developer/login and /student-learning/login
// land in flows that have account-bound state today.
//
// Global open trigger (this turn, D76): any "Try it now" / "Try it" CTA
// across the marketing surfaces (MarketingNav, WhyPage, TourPage,
// HeroLanding feature tiles) dispatches the TRY_IT_OPEN_EVENT instead
// of routing directly to /student-studio. Routing direct to /student-studio
// landed users on the tester-seat picker (LoginOverlay default mode) and
// also broke viewport scroll because the studio shell does not
// scroll-restore on mount. With the chooser hoisted to MarketingShell
// and listening to this event, every CTA reaches the choices step first.

export const TRY_IT_OPEN_EVENT = 'nt:open-try-it-chooser';

export function dispatchTryItChooserOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRY_IT_OPEN_EVENT));
}

interface TryItChooserProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'path' | 'studioSubChoice';

export default function TryItChooser({ open, onClose }: TryItChooserProps) {
  const [step, setStep] = useState<Step>('path');

  useEffect(() => {
    if (!open) {
      setStep('path');
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function pickLearning(): void {
    onClose();
    navigate('/student-learning');
  }

  function pickStudioStart(): void {
    setStep('studioSubChoice');
  }

  function pickTesterSeat(): void {
    onClose();
    // /login is the tester seat picker (LoginOverlay default mode).
    navigate('/login');
  }

  function pickAccountHolder(): void {
    onClose();
    // /developer/login starts the Google-account sign-in flow; account
    // holders can save their analysis history and learning progress.
    navigate('/developer/login');
  }

  return (
    <div
      className="nt-tryit"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tryit-title"
    >
      <div className="nt-tryit__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="nt-tryit__panel" role="document">
        {step === 'path' ? (
          <>
            <header className="nt-tryit__head">
              <p className="nt-tryit__eyebrow">Pick your path</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                How do you want to start?
              </h2>
              <p className="nt-tryit__lede">
                Read first, or skip to running your own code. Sign-in only happens if you pick the
                studio.
              </p>
              <button
                type="button"
                className="nt-tryit__close"
                onClick={onClose}
                aria-label="Close chooser"
              >
                ×
              </button>
            </header>

            <div className="nt-tryit__choices">
              <button type="button" className="nt-tryit__choice" onClick={pickLearning}>
                <span className="nt-tryit__choice-tag">Learning modules</span>
                <span className="nt-tryit__choice-title">Read first</span>
                <span className="nt-tryit__choice-blurb">
                  Walk through the lessons, see the patterns, then come back later. No sign-in.
                </span>
                <span className="nt-tryit__choice-arrow" aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                className="nt-tryit__choice nt-tryit__choice--studio"
                onClick={pickStudioStart}
              >
                <span className="nt-tryit__choice-tag">Studio app</span>
                <span className="nt-tryit__choice-title">Run my own C++</span>
                <span className="nt-tryit__choice-blurb">
                  Paste or upload a C++ file, click Analyze, get docs and tests. Sign-in required.
                </span>
                <span className="nt-tryit__choice-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="nt-tryit__head">
              <p className="nt-tryit__eyebrow">Studio sign-in</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                Tester seat or your own account?
              </h2>
              <p className="nt-tryit__lede">
                Testers borrow a shared seat; account holders get their saved runs and learning
                progress back next time they sign in.
              </p>
              <button
                type="button"
                className="nt-tryit__close"
                onClick={onClose}
                aria-label="Close chooser"
              >
                ×
              </button>
            </header>

            <div className="nt-tryit__choices">
              <button type="button" className="nt-tryit__choice" onClick={pickTesterSeat}>
                <span className="nt-tryit__choice-tag">Tester</span>
                <span className="nt-tryit__choice-title">Claim a shared seat</span>
                <span className="nt-tryit__choice-blurb">
                  Pick one of the open Devcon test seats. No account, no saved history. Good for a
                  one-time look around.
                </span>
                <span className="nt-tryit__choice-arrow" aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                className="nt-tryit__choice nt-tryit__choice--studio"
                onClick={pickAccountHolder}
              >
                <span className="nt-tryit__choice-tag">Account holder</span>
                <span className="nt-tryit__choice-title">Sign in with Google</span>
                <span className="nt-tryit__choice-blurb">
                  Your analysis runs and learning progress are saved to your account. Come back
                  later and pick up where you left off.
                </span>
                <span className="nt-tryit__choice-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>

            <div className="nt-tryit__foot">
              <button
                type="button"
                className="nt-tryit__back"
                onClick={() => setStep('path')}
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
