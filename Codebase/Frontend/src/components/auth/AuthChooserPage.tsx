// /auth/choose — Step 1 of the sign-in flow. Pick a role; the next
// page asks "new account or existing" and kicks off Google OAuth.
//
// Why pre-OAuth role picking: the old single-button flow returned a
// post-OAuth RoleChooserModal for new users, which felt like "sign in
// twice". Users want intent visible up front. Now: role → new/existing
// → OAuth → auto-route. No prompts after Google.

import { navigate } from '../../logic/router';

interface RoleCard {
  testId: string;
  title: string;
  body: string;
  cta: string;
  path: string;
  highlight: 'admin' | 'developer';
}

const CARDS: ReadonlyArray<RoleCard> = [
  {
    testId: 'auth-choose-developer',
    title: "I'm a developer",
    body:
      "Run analyses, see your saved history, and (if you have an invite) join your team's organization. " +
      "Otherwise you can use the public open-standards pattern catalog.",
    cta: 'Continue as developer →',
    path: '/developer/login',
    highlight: 'developer',
  },
  {
    testId: 'auth-choose-admin',
    title: "I'm a PM / admin",
    body:
      "Manage an organization, invite developers, upload pattern catalogs. " +
      "If your email is in the original-devs team, you land sa NeoTerritory admin. " +
      "Other admins get a self-serve organization.",
    cta: 'Continue as PM / admin →',
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
            Pick the role na bagay sa&rsquo;yo. Sa next step, sasabihin mo kung
            existing account o bago, tapos Google sign-in na lang.
          </p>
        </header>

        <div className="nt-auth-choose__grid">
          {CARDS.map((card) => (
            <button
              key={card.testId}
              type="button"
              className="nt-auth-choose__card"
              data-highlight={card.highlight}
              data-testid={card.testId}
              onClick={() => navigate(card.path)}
            >
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
