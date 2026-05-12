import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import SeatClaimPanel from '../auth/SeatClaimPanel';

// Homepage chooser popup. Single auth surface across the marketing site:
// every "Try it now" / hero / nav CTA dispatches TRY_IT_OPEN_EVENT and
// MarketingShell mounts this modal. Three cards, plus a nested seat-claim
// step for the Tester (Guest) path. Admin is intentionally hidden from
// the popup and reachable only via the direct /app route.
//
// The previous /choose entry page and the /login seat-pick page are gone;
// any seat-claim, sign-in, or pick-a-role flow now goes through this
// component.

export const TRY_IT_OPEN_EVENT = 'nt:open-try-it-chooser';

export function dispatchTryItChooserOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRY_IT_OPEN_EVENT));
}

interface TryItChooserProps {
  open: boolean;
  onClose: () => void;
}

type View = 'choices' | 'seatClaim';

interface ChoiceCard {
  id: 'tester' | 'student-learning' | 'developer';
  eyebrow: string;
  title: string;
  blurb: string;
}

const CARDS: ReadonlyArray<ChoiceCard> = [
  {
    id: 'tester',
    eyebrow: 'Guest',
    title: 'Claim a tester seat',
    blurb:
      'Pick one of the open Devcon seats and try the analyzer right now. No account, no saved history — good for a one-time look around.',
  },
  {
    id: 'student-learning',
    eyebrow: 'Learn first',
    title: 'Student Learning',
    blurb:
      'Walk through the lessons and see the patterns before running your own code. Reading is free; no sign-in needed.',
  },
  {
    id: 'developer',
    eyebrow: 'Sign in',
    title: 'Continue as Developer',
    blurb:
      'Sign in with Google. Your analysis runs and learning progress are saved to your account so you can come back later.',
  },
];

export default function TryItChooser({ open, onClose }: TryItChooserProps) {
  const [view, setView] = useState<View>('choices');
  const [testersHidden, setTestersHidden] = useState(false);

  // Reset to the choices step every time the popup re-opens so users
  // never re-enter on the seat-claim view from a previous dismissal.
  useEffect(() => {
    if (!open) {
      setView('choices');
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Mirror the admin's tester-visibility toggle: when an admin has
  // flipped testers off, the Tester (Guest) card disappears from the
  // popup so a public visitor only sees Learning + Developer. The
  // /auth/test-accounts endpoint already publishes `testersHidden`.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/auth/test-accounts', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { testersHidden?: boolean } | null) => {
        if (!cancelled && data && typeof data.testersHidden === 'boolean') {
          setTestersHidden(data.testersHidden);
        }
      })
      .catch(() => { /* network blip — leave default (visible) */ });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const visibleCards = testersHidden ? CARDS.filter(c => c.id !== 'tester') : CARDS;

  function pickCard(card: ChoiceCard): void {
    if (card.id === 'tester') {
      // Drop any stale entry-flow stamp so MainLayout treats this user
      // as a research participant (ConsentGate + Pretest apply).
      try { sessionStorage.removeItem('nt-entry-flow'); } catch { /* ignore */ }
      setView('seatClaim');
      return;
    }
    if (card.id === 'student-learning') {
      // Stamp the entry flow before navigating so MainLayout / GoogleCallback
      // know this is a real-account path when the user finishes OAuth.
      try { sessionStorage.setItem('nt-entry-flow', 'student'); } catch { /* ignore */ }
      onClose();
      navigate('/student-learning/login');
      return;
    }
    if (card.id === 'developer') {
      try { sessionStorage.setItem('nt-entry-flow', 'developer'); } catch { /* ignore */ }
      onClose();
      navigate('/developer/login');
      return;
    }
  }

  function onSeatClaimed(): void {
    onClose();
    navigate('/studio');
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
        {view === 'choices' && (
          <>
            <header className="nt-tryit__head">
              <p className="nt-tryit__eyebrow">Welcome to NeoTerritory</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                How do you want to start?
              </h2>
              <p className="nt-tryit__lede">
                The analyzer stays the same behind every path. Pick the one that matches how you
                want to use it.
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
              {visibleCards.map(card => (
                <button
                  key={card.id}
                  type="button"
                  className={`nt-tryit__choice nt-tryit__choice--${card.id}`}
                  data-role={card.id}
                  onClick={() => pickCard(card)}
                >
                  <span className="nt-tryit__choice-tag">{card.eyebrow}</span>
                  <span className="nt-tryit__choice-title">{card.title}</span>
                  <span className="nt-tryit__choice-blurb">{card.blurb}</span>
                  <span className="nt-tryit__choice-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'seatClaim' && (
          <>
            <header className="nt-tryit__head">
              <p className="nt-tryit__eyebrow">Tester guest</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                Pick an open seat
              </h2>
              <button
                type="button"
                className="nt-tryit__close"
                onClick={onClose}
                aria-label="Close chooser"
              >
                ×
              </button>
            </header>
            <SeatClaimPanel
              onClaimed={onSeatClaimed}
              onBack={() => setView('choices')}
            />
          </>
        )}
      </div>
    </div>
  );
}
