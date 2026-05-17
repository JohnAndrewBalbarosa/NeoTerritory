// Join requests admin tab. Lists pending developer-→-org requests
// generated from the developer onboarding wizard's "request-by-email"
// path. Admin accepts/rejects → backend creates the org_memberships
// row (on accept) and updates the request status.

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';

interface JoinRequestRow {
  id: number;
  requester_email: string;
  requester_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  decided_at: string | null;
}

interface ListResponse {
  requests: ReadonlyArray<JoinRequestRow>;
}

export default function JoinRequestsTab() {
  const [rows, setRows] = useState<ReadonlyArray<JoinRequestRow>>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const data = await apiFetch<ListResponse>('/auth/join-request/list');
      setRows(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load join requests.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function decide(id: number, action: 'accept' | 'reject'): Promise<void> {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/auth/join-request/${action}`, {
        method: 'POST',
        body: JSON.stringify({ requestId: id }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="admin-join-requests">
      <header className="admin-section__head">
        <p className="eyebrow">Join requests</p>
        <h2>Developers requesting to join your org</h2>
        <p className="admin-section__hint">
          Created via developer onboarding (request-by-email mode). Accept to
          create their membership; reject to dismiss.
        </p>
      </header>

      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="admin-section__hint">No pending join requests.</p>
      ) : (
        <div className="admin-catalog-list">
          {rows.map((r) => (
            <article
              key={r.id}
              className="admin-catalog-row"
              data-status={r.status}
            >
              <div className="admin-catalog-row__main">
                <strong>{r.requester_name || r.requester_email}</strong>
                <span className="admin-catalog-row__meta">
                  {r.requester_email} · {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <span
                className="admin-catalog-row__badge"
                data-active={r.status === 'accepted' ? 'true' : 'false'}
              >
                {r.status}
              </span>
              {r.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className="admin-catalog-row__meta">
                  {r.decided_at ? new Date(r.decided_at).toLocaleString() : ''}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
