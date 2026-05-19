// /auth/choose — Step 1: three-card entry chooser.
//
// Learners  = student-learning track. Account-gated so progress saves
//             across sessions. Lands on /student-learning/login → OAuth
//             → standalone learning shell at /patterns/learn.
// Guest     = one-time analyzer try-out without an account. Opens the
//             shared TryItChooser modal on the homepage so the seat-
//             claim flow runs through its existing surface.
// Developer = generic Google sign-in. The backend /exchange endpoint
//             auto-routes existing accounts to PM / admin / developer
//             surfaces based on stored membership. The original-devs
//             allowlist promotion (e.g. jbalbarosa15@gmail.com → admin)
//             happens SILENTLY along this path.

import { navigate } from '../../logic/router';
import { dispatchTryItChooserOpen } from '../marketing/TryItChooser';
import { useFeatureReleases } from '../../hooks/useFeatureReleases';

interface RoleCard {
  testId: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  highlight: 'learners' | 'guest' | 'developer';
  action: () => void;
}

const CARDS: ReadonlyArray<RoleCard> = [
  {
    testId: 'auth-choose-learners',
    eyebrow: 'Learn first',
    title: "I'm a learner",
    body:
      "Para sa students at self-learners. Mag-sign in with Google para ma-save ang progress mo sa learning path — pwedeng tuloy-tuloy across sessions.",
    cta: 'Continue as learner →',
    highlight: 'learners',
    action: () => navigate('/student-learning/login'),
  },
  {
    testId: 'auth-choose-guest',
    eyebrow: 'No account',
    title: "I'm a guest",
    body:
      "One-time look around — walang account, walang saved history. Mag-cloclaim ka ng guest seat tapos pwede mo nang subukan ang analyzer.",
    cta: 'Continue as guest →',
    highlight: 'guest',
    action: () => {
      navigate('/');
      // Defer until the marketing shell has mounted the TryItChooser listener.
      setTimeout(() => dispatchTryItChooserOpen(), 0);
    },
  },
  {
    testId: 'auth-choose-developer',
    eyebrow: 'Account',
    title: "I'm a developer",
    body:
      "Sign in with Google. Auto-route ka ng backend after OAuth — PM, admin, o developer, depende sa stored membership mo.",
    cta: 'Continue as developer →',
    highlight: 'developer',
    action: () => navigate('/developer/login'),
  },
];

export default function AuthChooserPage() {
  const { isReleased } = useFeatureReleases();
  const visibleCards = CARDS.filter((card) =>
    card.highlight === 'learners' ? isReleased('student-learning') : true,
  );

  return (
    <main className="nt-entry" id="main" data-testid="auth-choose">
      <section
        className="nt-entry-shell nt-auth-choose-shell"
        aria-labelledby="auth-choose-heading"
      >
        <header className="nt-entry__hero">
          <p className="nt-section-eyebrow">Sign in or create account</p>
          <h1 id="auth-choose-heading" className="nt-entry__title">
            How will you use CodiNeo?
          </h1>
          <p className="nt-entry__lede">
            Pick your entry. Learners mag-sa-sign in para masave ang progress;
            guests pwedeng tumingin lang ng one-time; developers (kasama na ang
            PM at admin accounts) ay deretso Google sign-in &mdash; auto-route
            ka after OAuth based sa stored membership.
          </p>
        </header>

        <div className="nt-auth-choose__grid nt-auth-choose__grid--three">
          {visibleCards.map((card) => (
            <button
              key={card.testId}
              type="button"
              className="nt-auth-choose__card"
              data-highlight={card.highlight}
              data-testid={card.testId}
              onClick={card.action}
            >
              <span className="nt-auth-choose__card-eyebrow">{card.eyebrow}</span>
              <span className="nt-auth-choose__card-title">{card.title}</span>
              <span className="nt-auth-choose__card-body">{card.body}</span>
              <span className="nt-auth-choose__card-cta">{card.cta}</span>
            </button>
          ))}
        </div>

        <footer className="nt-signin-foot nt-auth-choose__foot">
          <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
            ← Back to homepage
          </button>
        </footer>
      </section>
    </main>
  );
}
