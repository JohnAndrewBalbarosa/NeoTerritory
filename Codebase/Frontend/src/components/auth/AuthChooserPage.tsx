// /auth/choose — Step 1: three-card entry chooser.
//
// New user  = first-timer — onboarding wizard figures out role after OAuth.
// PM        = self-serve org owner (anyone with a Google account). The
//             original-devs allowlist promotion happens SILENTLY through
//             this path — if the email is in ORIGINAL_DEV_EMAILS, the
//             backend binds them to the NeoTerritory org and the
//             callback routes them to /admin. No separate admin card.
// Developer = joining an org via invite code / admin-email request, or
//             solo against the public open-standards catalog.
//
// Existing users (who pick any card) get auto-routed to their actual
// surface by the backend's /exchange endpoint based on their stored
// membership. The pre-OAuth choice is mostly an INTENT TAG for new
// users — existing accounts override it.

import { navigate } from '../../logic/router';

interface RoleCard {
  testId: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  path: string;
  highlight: 'pm' | 'new' | 'developer';
}

const CARDS: ReadonlyArray<RoleCard> = [
  {
    testId: 'auth-choose-new-user',
    eyebrow: 'First time',
    title: "I'm a new user",
    body:
      "Bago ka pa lang sa CodiNeo. Sign in with Google and we'll ask kung PM ka ba o developer sa onboarding.",
    cta: 'Continue as new user →',
    path: '/new-user/login',
    highlight: 'new',
  },
  {
    testId: 'auth-choose-pm',
    eyebrow: 'Org owner',
    title: "I'm a PM",
    body:
      "Project manager ng sarili mong organization. Mag-iinvite ka ng developers at mag-manage ng pattern catalogs. Pag bago ka, gagawa kami ng fresh org para sa'yo.",
    cta: 'Continue as PM →',
    path: '/pm/login',
    highlight: 'pm',
  },
  {
    testId: 'auth-choose-developer',
    eyebrow: 'Team member',
    title: "I'm a developer",
    body:
      "Sumali sa existing org gamit ang invite code o admin-email request. May solo path din kung gusto mong gamitin ang public open-standards catalog lang.",
    cta: 'Continue as developer →',
    path: '/developer/login',
    highlight: 'developer',
  },
];

export default function AuthChooserPage() {
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
            Pick your role. New users go through a quick onboarding; PMs at
            developers ay deretso sign-in. Existing accounts auto-route after
            Google &mdash; ang pre-OAuth choice ay para lang sa first-time setup.
          </p>
        </header>

        <div className="nt-auth-choose__grid nt-auth-choose__grid--three">
          {CARDS.map((card) => (
            <button
              key={card.testId}
              type="button"
              className="nt-auth-choose__card"
              data-highlight={card.highlight}
              data-testid={card.testId}
              onClick={() => navigate(card.path)}
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
