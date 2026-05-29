// /onboarding/* — first-time wizard mounted after Google OAuth for
// brand-new users (role='new' from the chooser). Auth gate redirects
// if no token (= didn't sign in) or if the user already has a
// membership (= shouldn't re-onboard).
//
// Sub-paths:
//   /onboarding/choose    → OnboardingChoose (admin or developer)
//   /onboarding/admin     → OnboardingAdmin (org name + invite emails)
//   /onboarding/developer → OnboardingDeveloper (solo / invite-code / request-by-email)

import { useEffect, useMemo, useState } from 'react';
import { navigate, replaceUrl, usePath } from '../../logic/router';
import { useAppStore } from '../../store/appState';
import type { User } from '../../types/api';

interface ExchangeUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  orgId?: string | null;
  isOriginalDevs?: boolean;
}

function userToStored(u: ExchangeUser): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email || '',
    role: u.role === 'admin' ? 'admin' : 'user',
    orgId: u.orgId ?? null,
    isOriginalDevs: u.isOriginalDevs === true,
  };
}

export default function OnboardingFlow() {
  const path = usePath();
  const token = useAppStore((s) => s.token);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    if (!token || !user) {
      // No session — kick back to the chooser.
      navigate('/auth/choose');
      return;
    }
    // Already a member → skip onboarding entirely.
    if (user.orgId || user.role === 'admin' || user.isOriginalDevs) {
      window.location.assign('/admin');
      return;
    }
  }, [token, user]);

  if (!token || !user) {
    return null;
  }

  if (path === '/onboarding/admin') return <OnboardingAdmin />;
  if (path === '/onboarding/developer') return <OnboardingDeveloper />;
  return <OnboardingChoose />;
}

function OnboardingChoose() {
  return (
    <main className="nt-entry" id="main" data-testid="onboarding-choose">
      <section className="nt-entry-shell nt-auth-choose-shell">
        <header className="nt-entry__hero">
          <p className="nt-section-eyebrow">Onboarding · Step 1 of 2</p>
          <h1 className="nt-entry__title">Welcome! How will you use CodiNeo?</h1>
          <p className="nt-entry__lede">
            Pick one. We&rsquo;ll save your choice so we never ask again.
          </p>
        </header>

        <div className="nt-auth-choose__grid">
          <button
            type="button"
            className="nt-auth-choose__card"
            data-highlight="pm"
            data-testid="onboarding-choose-admin"
            onClick={() => navigate('/onboarding/admin')}
          >
            <span className="nt-auth-choose__card-title">I&rsquo;ll administer an organization</span>
            <span className="nt-auth-choose__card-body">
              We&rsquo;ll create a new org for you. You can also invite developers
              by email or hand out invite codes.
            </span>
            <span className="nt-auth-choose__card-cta">Continue as admin →</span>
          </button>

          <button
            type="button"
            className="nt-auth-choose__card"
            data-highlight="developer"
            data-testid="onboarding-choose-developer"
            onClick={() => navigate('/onboarding/developer')}
          >
            <span className="nt-auth-choose__card-title">I&rsquo;m a developer</span>
            <span className="nt-auth-choose__card-body">
              Solo developer (open-standards catalog), have an invite code, or
              request to join your admin&rsquo;s org.
            </span>
            <span className="nt-auth-choose__card-cta">Continue as developer →</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function OnboardingAdmin() {
  const setAuth = useAppStore((s) => s.setAuth);
  const token = useAppStore((s) => s.token);
  const [orgName, setOrgName] = useState('');
  const [inviteEmailsRaw, setInviteEmailsRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteEmails = useMemo(() => {
    return inviteEmailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  }, [inviteEmailsRaw]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || !token) return;
    if (!orgName.trim()) {
      setError('Organization name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/auth/onboarding/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ orgName: orgName.trim(), inviteEmails }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `Onboarding failed (${r.status})`);
      setAuth(body.token, userToStored(body.user));
      window.location.assign('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed.');
      setBusy(false);
    }
  }

  return (
    <main className="nt-entry" id="main" data-testid="onboarding-admin">
      <section className="nt-entry-shell nt-onboarding-shell">
        <header className="nt-entry__hero">
          <p className="nt-section-eyebrow">Onboarding · Step 2 of 2 (Admin)</p>
          <h1 className="nt-entry__title">Set up your organization</h1>
          <p className="nt-entry__lede">
            Want to invite developers right away? Optional &mdash; you can come
            back to this in your admin page.
          </p>
        </header>

        <form className="nt-onboarding-form" onSubmit={submit}>
          <label className="nt-onboarding-field">
            <span>Organization name</span>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              maxLength={64}
              required
              disabled={busy}
              placeholder="e.g. Acme Engineering"
            />
          </label>

          <label className="nt-onboarding-field">
            <span>Invite developer emails (optional)</span>
            <textarea
              value={inviteEmailsRaw}
              onChange={(e) => setInviteEmailsRaw(e.target.value)}
              rows={4}
              disabled={busy}
              placeholder="dev1@example.com, dev2@example.com&#10;dev3@example.com"
            />
            <small className="nt-onboarding-hint">
              Detected {inviteEmails.length} valid email
              {inviteEmails.length === 1 ? '' : 's'}. Comma, semicolon, or newline
              separated. Each one receives an invite via email.
            </small>
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="nt-onboarding-actions">
            <button type="button" className="ghost-btn" onClick={() => navigate('/onboarding/choose')}>
              ← Back
            </button>
            <button type="submit" className="primary-btn" disabled={busy || !orgName.trim()}>
              {busy ? 'Setting up…' : 'Create org and go to /admin'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function OnboardingDeveloper() {
  const setAuth = useAppStore((s) => s.setAuth);
  const token = useAppStore((s) => s.token);
  const [mode, setMode] = useState<'solo' | 'invite-code' | 'request-by-email'>('solo');
  const [code, setCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/auth/onboarding/developer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          mode,
          code: mode === 'invite-code' ? code.trim() : undefined,
          adminEmail: mode === 'request-by-email' ? adminEmail.trim() : undefined,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `Onboarding failed (${r.status})`);
      if (body.token) setAuth(body.token, userToStored(body.user));
      if (body.pending === true) {
        try {
          window.sessionStorage.setItem('nt-pending-join', '1');
        } catch {
          /* ignore */
        }
      }
      replaceUrl('/studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed.');
      setBusy(false);
    }
  }

  return (
    <main className="nt-entry" id="main" data-testid="onboarding-developer">
      <section className="nt-entry-shell nt-onboarding-shell">
        <header className="nt-entry__hero">
          <p className="nt-section-eyebrow">Onboarding · Step 2 of 2 (Developer)</p>
          <h1 className="nt-entry__title">Solo, or part of an organization?</h1>
          <p className="nt-entry__lede">Pick one to finish setup.</p>
        </header>

        <form className="nt-onboarding-form" onSubmit={submit}>
          <fieldset className="nt-signin-intent">
            <legend className="nt-signin-intent__legend">Developer setup</legend>

            <label className="nt-signin-intent__option">
              <input
                type="radio"
                name="dev-mode"
                value="solo"
                checked={mode === 'solo'}
                onChange={() => setMode('solo')}
              />
              <span className="nt-signin-intent__label">
                <strong>Solo developer</strong>
                <span>Use the public open-standards pattern catalog. No invite needed.</span>
              </span>
            </label>

            <label className="nt-signin-intent__option">
              <input
                type="radio"
                name="dev-mode"
                value="invite-code"
                checked={mode === 'invite-code'}
                onChange={() => setMode('invite-code')}
              />
              <span className="nt-signin-intent__label">
                <strong>I have an invite code</strong>
                <span>6-character code given by your admin. Auto-join, no approval needed.</span>
              </span>
            </label>

            <label className="nt-signin-intent__option">
              <input
                type="radio"
                name="dev-mode"
                value="request-by-email"
                checked={mode === 'request-by-email'}
                onChange={() => setMode('request-by-email')}
              />
              <span className="nt-signin-intent__label">
                <strong>Request to join my admin&rsquo;s org</strong>
                <span>Enter admin&rsquo;s Google email. Admin sees a pending request to accept.</span>
              </span>
            </label>
          </fieldset>

          {mode === 'invite-code' && (
            <label className="nt-onboarding-field">
              <span>Invite code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                disabled={busy}
                placeholder="ABC123"
                data-testid="onboarding-dev-invite-code"
              />
            </label>
          )}

          {mode === 'request-by-email' && (
            <label className="nt-onboarding-field">
              <span>Admin&rsquo;s email</span>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={busy}
                placeholder="admin@example.com"
                data-testid="onboarding-dev-admin-email"
              />
            </label>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="nt-onboarding-actions">
            <button type="button" className="ghost-btn" onClick={() => navigate('/onboarding/choose')}>
              ← Back
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={
                busy ||
                (mode === 'invite-code' && code.trim().length < 4) ||
                (mode === 'request-by-email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()))
              }
            >
              {busy ? 'Finishing…' : 'Continue to /studio'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
