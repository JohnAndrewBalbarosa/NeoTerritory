import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import SeatClaimPanel from '../auth/SeatClaimPanel';
import { useFeatureReleases } from '../../hooks/useFeatureReleases';
import { useScrollLock } from '../../hooks/useScrollLock';

// Homepage chooser popup. Single public-facing auth surface across the
// marketing site: every "Try it now" / hero / nav CTA dispatches
// TRY_IT_OPEN_EVENT and MarketingShell mounts this modal.
//
// Product is learning-only (no developer mode; the Studio is only the
// practical-exam wrapper inside a module). So both public paths land on the
// LEARNING PATH (/patterns/learn):
//   - Guest: claim an open guest seat, then start learning (progress in-memory).
//   - Sign in: Google OAuth, then learn with progress saved across devices.
// PM sign-in is hidden behind the `pm-accounts` flag (org management). Admins
// reach OAuth via the /admin route. The retired /choose + /login pages are gone.

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
  id: 'tester' | 'student-learning' | 'pm';
  eyebrow: string;
  title: string;
  blurb: string;
}

const CARDS: ReadonlyArray<ChoiceCard> = [
  {
    id: 'tester',
    eyebrow: 'Guest',
    title: 'Start as a guest',
    blurb:
      'Claim an open guest seat and jump straight into the learning path — no account needed. Progress is kept for this visit only.',
  },
  {
    id: 'student-learning',
    eyebrow: 'Sign in',
    title: 'Sign in to save progress',
    blurb:
      'Sign in with Google to keep your module progress across devices. Reading the lessons is free — sign-in just remembers where you left off.',
  },
];

// Optional PM card — only injected when the `pm-accounts` feature flag is
// released. The card lives outside the base CARDS so existing visitors
// without the flag see the unchanged learner chooser.
const PM_CARD: ChoiceCard = {
  id: 'pm',
  eyebrow: 'Project manager',
  title: 'I manage a CodiNeo org',
  blurb:
    'PM sign-in: manage testers and the admin side. Backend auto-routes via Google OAuth.',
};

export default function TryItChooser({ open, onClose }: TryItChooserProps) {
  const [view, setView] = useState<View>('choices');
  const [testersHidden, setTestersHidden] = useState(false);
  const { isReleased } = useFeatureReleases();
  const pmEnabled = isReleased('pm-accounts');

  // Pin the homepage behind the chooser: while the popup is open the body
  // stops scrolling (no background drift), and the panel itself owns the
  // only scroll region. Called before the `if (!open) return null` below so
  // the hook order stays stable across renders.
  useScrollLock(open);

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

  // Mirror the admin's tester-visibility toggle: when an admin has flipped
  // testers off, the Guest card disappears so a public visitor only sees the
  // Sign-in path. The /auth/test-accounts endpoint publishes `testersHidden`.
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

  const baseCards = testersHidden ? CARDS.filter(c => c.id !== 'tester') : CARDS;
  const visibleCards = pmEnabled ? [...baseCards, PM_CARD] : baseCards;

  function pickCard(card: ChoiceCard): void {
    if (card.id === 'tester') {
      // Guest path: clear any stale entry-flow stamp, then claim a seat below.
      try { sessionStorage.removeItem('nt-entry-flow'); } catch { /* ignore */ }
      setView('seatClaim');
      return;
    }
    if (card.id === 'student-learning') {
      // Stamp the learner entry flow before navigating so GoogleCallback lands
      // the user on the learning path after OAuth.
      try { sessionStorage.setItem('nt-entry-flow', 'learner'); } catch { /* ignore */ }
      onClose();
      navigate('/student-learning/login');
      return;
    }
    if (card.id === 'pm') {
      // PM-accounts feature flag path. Stamp the entry flow and land on
      // /pm/login (the Google sign-in surface keyed to the PM role).
      try { sessionStorage.setItem('nt-entry-flow', 'pm'); } catch { /* ignore */ }
      onClose();
      navigate('/pm/login');
      return;
    }
  }

  function onSeatClaimed(): void {
    // Learning-only: a claimed guest lands on the learning path, not a
    // standalone studio (the Studio now lives inside module practicals).
    onClose();
    navigate('/patterns/learn');
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
              <p className="nt-tryit__eyebrow">Welcome to CodiNeo</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                How do you want to start?
              </h2>
              <p className="nt-tryit__lede">
                Both paths open the same learning path. Pick whether you want to keep your
                progress.
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
              <p className="nt-tryit__eyebrow">Guest seat</p>
              <h2 id="tryit-title" className="nt-tryit__title">
                Claim an open guest seat
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
