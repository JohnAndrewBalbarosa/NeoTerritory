// First-time role prompt. Mounted by GoogleCallback when the backend's
// /auth/google/exchange response sets promptRoleChoice=true. Two big
// buttons. The user's pick is sent to /auth/google/finalize-role, which
// runs the admin org logic (allowlist or self-serve) and re-mints the
// JWT with the resolved org membership. After that, the modal closes
// and GoogleCallback navigates to /admin or /studio accordingly.

import { useState } from 'react';

interface Props {
  bearerToken: string;
  onChosen: (next: { token: string; role: 'admin' | 'developer'; orgId: string | null; isOriginalDevs: boolean }) => void;
}

interface FinalizeResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string;
    orgId: string | null;
    isOriginalDevs: boolean;
  };
  chosenRole: 'admin' | 'developer';
  orgCreated: boolean;
}

export default function RoleChooserModal({ bearerToken, onChosen }: Props) {
  const [busy, setBusy] = useState<'admin' | 'developer' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(role: 'admin' | 'developer'): Promise<void> {
    setBusy(role);
    setError(null);
    try {
      const r = await fetch('/auth/google/finalize-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `finalize-role failed (${r.status})`);
      }
      const data = (await r.json()) as FinalizeResponse;
      onChosen({
        token: data.token,
        role: data.chosenRole,
        orgId: data.user.orgId,
        isOriginalDevs: data.user.isOriginalDevs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your role');
      setBusy(null);
    }
  }

  return (
    <div
      className="nt-role-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
      data-testid="role-chooser-modal"
    >
      <div className="nt-role-modal__backdrop" aria-hidden="true" />
      <section className="nt-role-modal__panel">
        <header className="nt-role-modal__head">
          <p className="nt-section-eyebrow">One-time setup</p>
          <h2 id="role-modal-title" className="nt-role-modal__title">
            Welcome! How will you use CodiNeo?
          </h2>
          <p className="nt-role-modal__lede">
            Pick one. We&rsquo;ll save your choice so we never ask again.
            Admins/PMs get an organization with catalog management; developers
            join an existing org via invite or use the open-standards catalog.
          </p>
        </header>

        <div className="nt-role-modal__grid">
          <button
            type="button"
            className="nt-role-modal__card"
            data-highlight="admin"
            onClick={() => choose('admin')}
            disabled={busy !== null}
            data-testid="role-chooser-admin"
          >
            <span className="nt-role-modal__card-title">I&rsquo;m a PM / admin</span>
            <span className="nt-role-modal__card-body">
              Manage an organization, invite developers, upload pattern catalogs.
              {' '}If your email is the original-devs team, you land sa NeoTerritory
              admin. Otherwise we spin up a new org owned by you.
            </span>
            <span className="nt-role-modal__card-cta">
              {busy === 'admin' ? 'Setting up org…' : 'Choose admin →'}
            </span>
          </button>

          <button
            type="button"
            className="nt-role-modal__card"
            data-highlight="developer"
            onClick={() => choose('developer')}
            disabled={busy !== null}
            data-testid="role-chooser-developer"
          >
            <span className="nt-role-modal__card-title">I&rsquo;m a developer</span>
            <span className="nt-role-modal__card-body">
              Run analysis, see your saved history. Redeem an invite token to
              join an admin&rsquo;s org, or just use the open-standards pattern
              catalog publicly.
            </span>
            <span className="nt-role-modal__card-cta">
              {busy === 'developer' ? 'Saving…' : 'Choose developer →'}
            </span>
          </button>
        </div>

        {error && (
          <p className="auth-error" role="alert">{error}</p>
        )}
      </section>
    </div>
  );
}
