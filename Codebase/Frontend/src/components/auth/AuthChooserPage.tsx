// /auth/choose — the explicit "I'm a PM/admin" vs "I'm a developer"
// fork. Both buttons route to a role-tagged Google sign-in surface;
// the post-OAuth landing depends on the email / membership lookup the
// backend does in /auth/google/exchange.
//
// Why two buttons instead of transparent routing: per the user, the
// intent should be visible up front so PMs aren't surprised to land
// on a developer studio (or vice versa) just because their email
// happens to match a seed list. The intent the user clicked is what
// the backend honours.

import { navigate } from '../../logic/router';

interface RolePathCard {
  testId: string;
  title: string;
  body: string;
  cta: string;
  path: string;
  highlight: 'admin' | 'developer';
}

const CARDS: ReadonlyArray<RolePathCard> = [
  {
    testId: 'auth-choose-admin',
    title: "I'm a PM / admin",
    body:
      "Manage an organization, invite developers, upload pattern catalogs. " +
      "If your email is in the original-devs team, you land sa NeoTerritory admin. " +
      "Other emails get an automatic new organization to own.",
    cta: 'Continue with Google · PM/admin',
    path: '/admin/login',
    highlight: 'admin',
  },
  {
    testId: 'auth-choose-developer',
    title: "I'm a developer",
    body:
      "Join an existing organization with an invite token from your PM. " +
      "Without an invite, you can still sign in to use the studio publicly " +
      "with the open-standards pattern catalog.",
    cta: 'Continue with Google · developer',
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
          <p className="nt-section-eyebrow">Sign in</p>
          <h1 id="auth-choose-heading" className="nt-entry__title">
            How are you joining CodiNeo?
          </h1>
          <p className="nt-entry__lede">
            Pick the path that matches what you&rsquo;re here to do. Both options use
            Google sign-in — we never see your password.
          </p>
        </header>

        <div className="nt-auth-choose__grid">
          {CARDS.map((card) => (
            <article
              key={card.testId}
              className="nt-auth-choose__card"
              data-highlight={card.highlight}
              data-testid={card.testId}
            >
              <h2 className="nt-auth-choose__card-title">{card.title}</h2>
              <p className="nt-auth-choose__card-body">{card.body}</p>
              <button
                type="button"
                className="primary-btn nt-auth-choose__cta"
                onClick={() => navigate(card.path)}
              >
                {card.cta}
              </button>
            </article>
          ))}
        </div>

        <footer className="nt-signin-foot nt-auth-choose__foot">
          <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
            ← Back to homepage
          </button>
          <p className="nt-auth-choose__hint">
            Looking for the legacy tester (username/password) login? Use{' '}
            <button
              type="button"
              className="nt-link-btn"
              onClick={() => navigate('/admin')}
            >
              admin sign in
            </button>{' '}
            or pick &ldquo;Try as guest&rdquo; from the homepage.
          </p>
        </footer>
      </section>
    </main>
  );
}
