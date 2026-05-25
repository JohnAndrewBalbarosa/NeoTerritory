import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import SeatClaimPanel from '../auth/SeatClaimPanel';
import { useFeatureReleases } from '../../hooks/useFeatureReleases';
import { useAppStore } from '../../store/appState';
import { useScrollLock } from '../../hooks/useScrollLock';

// Homepage chooser popup. Single public-facing auth surface across the
// marketing site: every "Try it now" / hero / nav CTA dispatches
// TRY_IT_OPEN_EVENT and MarketingShell mounts this modal. Three cards
// (Tester / Student / Developer), plus a nested seat-claim step for
// the Tester (Guest) path.
//
// PM / admin sign-in is intentionally HIDDEN from this public popup —
// admins reach the OAuth flow via either:
//   1. The /auth/choose page (URL-addressable two-button picker), or
//   2. The /admin route, which renders an admin sign-in card with a
//      "Sign in with Google" button (and a hidden legacy
//      username/password fallback for the seeded thesis admin).
//
// The previous /choose entry page and the /login seat-pick page are gone;
// any public seat-claim, sign-in, or pick-a-role flow now goes through
// this component.

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
  id: 'tester' | 'student-learning' | 'developer' | 'pm';
  eyebrow: string;
  title: string;
  blurb: string;
}

const CARDS: ReadonlyArray<ChoiceCard> = [
  {
    id: 'tester',
    eyebrow: 'Guest',
    title: 'Try as guest',
    blurb:
      'Continue as a guest to try the analyzer. No account, no saved history — good for a one-time look around.',
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
    eyebrow: 'Account',
    title: 'Sign in or create account',
    blurb:
      'Sign in with Google. Whether your account is new or existing, we set it up automatically — then you go straight to /studio, with your runs and history saved.',
  },
];

// Optional PM card — only injected when the `pm-accounts` feature flag is
// released. The card lives outside the base CARDS so existing visitors
// without the flag see the unchanged three-card chooser.
const PM_CARD: ChoiceCard = {
  id: 'pm',
  eyebrow: 'Project manager',
  title: 'I manage a CodiNeo org',
  blurb:
    "PM sign-in: manage testers, invite developers, and switch between the studio and admin sides. Backend auto-routes via Google OAuth.",
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

  const baseCards = testersHidden ? CARDS.filter(c => c.id !== 'tester') : CARDS;
  const visibleCards = pmEnabled ? [...baseCards, PM_CARD] : baseCards;

  function pickCard(card: ChoiceCard): void {
    if (card.id === 'tester') {
      // Drop any stale entry-flow stamp so MainLayout treats this user
      // as a research participant.
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
      // Account path. Two cases per the homepage spec:
      //   1. Already signed in → skip OAuth entirely, go straight to
      //      /studio (auth is rehydrated from localStorage at store init,
      //      so this survives a refresh).
      //   2. Not signed in → hand off to the same Google sign-in surface
      //      the student path uses (GoogleSignInPage), but with
      //      intent=new so the backend create-or-sign-in upsert runs.
      //      intent=new is the universal path: a brand-new Gmail gets a
      //      developer account auto-created, an existing email is matched
      //      to its row — neither hits the intent=existing 404. role
      //      'developer' resolves next=/studio, so GoogleCallback lands
      //      the user directly in the studio (no onboarding detour, since
      //      needsOnboarding is only set for the 'new' role).
      //
      // The previous target, /auth/choose, is a retired surface that
      // MarketingShell bounces back to '/', which is why clicking Account
      // looped the user back to the homepage instead of authenticating.
      const { token, user } = useAppStore.getState();
      if (token && user) {
        onClose();
        navigate('/studio');
        return;
      }
      try { sessionStorage.setItem('nt-entry-flow', 'developer'); } catch { /* ignore */ }
      onClose();
      navigate('/developer/login?intent=new');
      return;
    }
    if (card.id === 'pm') {
      // PM-accounts feature flag path. Stamp the entry flow and land
      // on /pm/login (the Google sign-in surface keyed to the PM role).
      try { sessionStorage.setItem('nt-entry-flow', 'pm'); } catch { /* ignore */ }
      onClose();
      navigate('/pm/login');
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
              <p className="nt-tryit__eyebrow">Welcome to CodiNeo</p>
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
