import { useEffect, useState } from 'react';

const DISMISS_KEY = 'nt_start_here_dismissed';
const FORCE_OPEN_EVENT = 'nt:start-here:open';

// Per D45 (Sprint -1b): persistent first-run rail anchored above the studio
// analysis form. Three numbered steps reflect the literal action sequence the
// user must perform: load a sample, click Analyze, read the result.
//
// Visibility model:
//   - Default: expanded on first visit. Collapses to a small pill once
//     dismissed. The pill stays as a re-open affordance.
//   - Dismissal: explicit close button writes localStorage[DISMISS_KEY]='1'
//     so the rail does not re-expand on subsequent sessions.
//   - Force-open: any element on the page can dispatch the
//     `nt:start-here:open` event (used by the studio header `?` button) to
//     re-expand the rail without clearing the dismissal flag.
//
// State scope is intentionally browser-local (localStorage), not the auth
// store. Per D45 this is a UI affordance per surface, not a per-account
// preference, and we do not introduce DB schema for ephemeral UI state.

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(DISMISS_KEY, '1');
    else window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* storage blocked — fall back to in-memory only */
  }
}

interface StartHereRailProps {
  onLoadSample?: () => void;
}

export default function StartHereRail({ onLoadSample }: StartHereRailProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => readDismissed());

  useEffect(() => {
    function handleForceOpen(): void {
      setCollapsed(false);
    }
    window.addEventListener(FORCE_OPEN_EVENT, handleForceOpen);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, handleForceOpen);
  }, []);

  function dismiss(): void {
    writeDismissed(true);
    setCollapsed(true);
  }

  function reopen(): void {
    setCollapsed(false);
  }

  function handleLoadSampleClick(): void {
    if (onLoadSample) {
      onLoadSample();
      return;
    }
    // Fallback: drive the existing Load-sample button if the parent did not
    // wire a callback. Keeps the rail useful even when dropped into a tab
    // that owns its own analysis form.
    const btn = document.getElementById('load-sample-btn');
    if (btn instanceof HTMLButtonElement) btn.click();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="nt-start-here nt-start-here--pill"
        onClick={reopen}
        aria-label="Re-open the Start here guide"
      >
        <span className="nt-start-here__pill-dot" aria-hidden="true">?</span>
        <span>Start here</span>
      </button>
    );
  }

  return (
    <aside className="nt-start-here nt-start-here--expanded" aria-labelledby="start-here-heading">
      <header className="nt-start-here__head">
        <p className="nt-start-here__eyebrow">First time here?</p>
        <h2 id="start-here-heading" className="nt-start-here__title">
          Start here. Three steps.
        </h2>
        <button
          type="button"
          className="nt-start-here__close"
          onClick={dismiss}
          aria-label="Hide the Start here guide"
        >
          ×
        </button>
      </header>

      <ol className="nt-start-here__steps">
        <li className="nt-start-here__step">
          <span className="nt-start-here__num">1</span>
          <div className="nt-start-here__step-body">
            <h3>Load a sample</h3>
            <p>Pick any sample C++ file. We pre-fill it for you.</p>
            <button
              type="button"
              className="nt-start-here__action"
              onClick={handleLoadSampleClick}
            >
              Load sample
            </button>
          </div>
        </li>
        <li className="nt-start-here__step">
          <span className="nt-start-here__num">2</span>
          <div className="nt-start-here__step-body">
            <h3>Click Analyze</h3>
            <p>The big button under the editor. NeoTerritory reads the file and finds patterns.</p>
          </div>
        </li>
        <li className="nt-start-here__step">
          <span className="nt-start-here__num">3</span>
          <div className="nt-start-here__step-body">
            <h3>Read the result</h3>
            <p>Pattern cards appear below. Each one explains what we saw and why.</p>
          </div>
        </li>
      </ol>
    </aside>
  );
}

export function dispatchStartHereOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORCE_OPEN_EVENT));
}
