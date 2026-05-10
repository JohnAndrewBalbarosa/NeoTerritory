import { useEffect } from 'react';
import { navigate } from '../../logic/router';

// Per user direction (this turn): clicking "Try it now" on the Home page no
// longer routes straight to the gated studio. Instead it opens this chooser
// asking whether the visitor wants the Learning module (no auth) or the
// Studio app (auth required). Sign-in is only triggered when the visitor
// picks Studio.

interface TryItChooserProps {
  open: boolean;
  onClose: () => void;
}

export default function TryItChooser({ open, onClose }: TryItChooserProps) {
  useEffect(() => {
    if (!open) return;
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

  function pickStudio(): void {
    onClose();
    navigate('/student-studio');
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
            <span className="nt-tryit__choice-tag">Learning module</span>
            <span className="nt-tryit__choice-title">Read first</span>
            <span className="nt-tryit__choice-blurb">
              Walk through the lessons, see the patterns, then come back later. No sign-in.
            </span>
            <span className="nt-tryit__choice-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button type="button" className="nt-tryit__choice nt-tryit__choice--studio" onClick={pickStudio}>
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
      </div>
    </div>
  );
}
