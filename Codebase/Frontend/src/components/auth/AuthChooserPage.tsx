// /auth/choose — Step 1: three-card entry chooser.
//
// Admin = original-devs allowlist only (super admin tier).
// PM    = self-serve org owner (anyone with a Google account).
// New   = first-timer — onboarding wizard figures out role after OAuth.
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
  highlight: 'admin' | 'pm' | 'new';
}

const CARDS: ReadonlyArray<RoleCard> = [
  {
    testId: 'auth-choose-new-user',
    eyebrow: 'First time',
    title: "I'm a new user",
    body:
      "Bago ka pa lang sa CodiNeo. Sign in with Google and we'll ask kung admin ka ba o developer sa onboarding.",
    cta: 'Continue as new user →',
    path: '/new-user/login',
    highlight: 'new',
  },
  {
    testId: 'auth-choose-pm',
    eyebrow: 'Org owner',
    title: "I'm a PM",
    body:
      "Project manager / admin ng sarili mong organization. Mag-iinvite ka ng developers at mag-manage ng pattern catalogs. Pag bago ka, gagawa kami ng fresh org para sa'yo.",
    cta: 'Continue as PM →',
    path: '/pm/login',
    highlight: 'pm',
  },
  {
    testId: 'auth-choose-admin',
    eyebrow: 'Super admin',
    title: "I'm an admin",
    body:
      "Para sa NeoTerritory original-devs lang (Andrew / Miryl / Josephine). Full thesis-grade admin tabs. Iba pang email, redirected sa PM sign-in.",
    cta: 'Continue as admin →',
    path: '/admin/login',
    highlight: 'admin',
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
            Pick the role na bagay sa&rsquo;yo. Existing accounts auto-route after
            Google sign-in &mdash; the pre-OAuth choice is mainly for first-time
            users.
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
