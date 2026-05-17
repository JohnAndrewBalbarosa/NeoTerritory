// /auth/choose — unified entry surface for sign-in AND sign-up via
// Supabase Google OAuth. One primary button:
//   "Continue with Google" → /auth/callback with role='unspecified'
//
// Post-OAuth the backend reports promptRoleChoice for brand-new users
// or returning users without a stored role. GoogleCallback then mounts
// RoleChooserModal, the user picks "I'm a PM/admin" or "I'm a developer",
// and the backend commits the chosen role via /auth/google/finalize-role.
//
// Existing users (with a stored membership) skip the prompt and route
// straight to their surface.
//
// Power-user shortcut: small secondary links below the main button let
// returning users skip the prompt by going to /admin/login or
// /developer/login directly — same OAuth flow, pre-tagged intent.

import { navigate } from '../../logic/router';
import GoogleSignInButton from './GoogleSignInButton';

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
            Continue to CodiNeo
          </h1>
          <p className="nt-entry__lede">
            One button, Google sign-in via Supabase. New here? We&rsquo;ll ask
            once kung admin/PM ka ba o developer after sign-in.
          </p>
        </header>

        <div className="nt-auth-choose__primary">
          <GoogleSignInButton role="unspecified" redirectAfter="/" />
        </div>

        <details className="nt-auth-choose__shortcuts">
          <summary>I already know my role — go direct</summary>
          <p className="nt-auth-choose__hint">
            Tinago dahil unified flow ang default. Use these only if you want
            to skip the role prompt for a returning account.
          </p>
          <div className="nt-auth-choose__shortcut-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate('/admin/login')}
              data-testid="auth-choose-admin-shortcut"
            >
              Sign in as PM / admin →
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate('/developer/login')}
              data-testid="auth-choose-developer-shortcut"
            >
              Sign in as developer →
            </button>
          </div>
        </details>

        <footer className="nt-signin-foot nt-auth-choose__foot">
          <button type="button" className="ghost-btn" onClick={() => navigate('/')}>
            ← Back to homepage
          </button>
        </footer>
      </section>
    </main>
  );
}
