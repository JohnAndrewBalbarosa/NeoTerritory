// Invite codes admin tab. Admin generates short alphanumeric codes
// that developers can paste during onboarding to fast-path-join the
// org (skips the manual approval step). Each code defaults to 10
// uses and 14-day expiry; tunable later.

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';

interface InviteCodeRow {
  id: number;
  code: string;
  uses_remaining: number;
  expires_at: string | null;
  created_at: string;
}

interface ListResponse {
  codes: ReadonlyArray<InviteCodeRow>;
}

interface CreateResponse {
  code: string;
  expiresAt: string;
  usesRemaining: number;
}

export default function InviteCodesTab() {
  const [rows, setRows] = useState<ReadonlyArray<InviteCodeRow>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const data = await apiFetch<ListResponse>('/auth/invite-code/list');
      setRows(data.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite codes.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<CreateResponse>('/auth/invite-code/create', { method: 'POST' });
      setJustCreated(data.code);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code.');
    } finally {
      setBusy(false);
    }
  }

  function copy(code: string): void {
    try {
      void navigator.clipboard?.writeText(code);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="admin-invite-codes">
      <header className="admin-section__head">
        <p className="eyebrow">Invite codes</p>
        <h2>Fast-path developer join codes</h2>
        <p className="admin-section__hint">
          Share a code with a developer; they paste it during onboarding and
          auto-join your organization with no Project Manager approval. Defaults: 10 uses, 14-day
          expiry.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button
          type="button"
          className="primary-btn"
          onClick={generate}
          disabled={busy}
          data-testid="admin-invite-codes-create"
        >
          {busy ? 'Generating…' : 'Generate new code'}
        </button>
        {justCreated && (
          <span className="admin-catalog-row__badge" data-active="true">
            New: <code>{justCreated}</code>
          </span>
        )}
      </div>

      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="admin-section__hint">No invite codes yet. Click &ldquo;Generate new code&rdquo; above.</p>
      ) : (
        <div className="admin-catalog-list">
          {rows.map((r) => (
            <article key={r.id} className="admin-catalog-row">
              <div className="admin-catalog-row__main">
                <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>
                  {r.code}
                </strong>
                <span className="admin-catalog-row__meta">
                  {r.uses_remaining} uses left ·
                  {' '}created {new Date(r.created_at).toLocaleDateString()}
                  {r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}` : ''}
                </span>
              </div>
              <span
                className="admin-catalog-row__badge"
                data-active={r.uses_remaining > 0 ? 'true' : 'false'}
              >
                {r.uses_remaining > 0 ? 'active' : 'exhausted'}
              </span>
              <button type="button" className="ghost-btn" onClick={() => copy(r.code)}>
                Copy
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
