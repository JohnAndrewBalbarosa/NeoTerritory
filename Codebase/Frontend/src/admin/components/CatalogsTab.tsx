// Catalogs tab — admins upload JSON pattern catalogs that will (in a
// follow-up turn) flow into the C++ parser. For now uploaded payloads
// are stored per-org but is_active_in_parser stays false, so each row
// shows a "Stored, not yet routed to parser" badge. This makes the
// dud-state explicit to the operator instead of pretending the upload
// already drives detection.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api/client';

interface CatalogRow {
  id: number;
  org_id: string;
  name: string;
  is_active_in_parser: number;
  uploaded_by_user_id: number | null;
  created_at: string;
}

interface CatalogsResponse {
  catalogs: ReadonlyArray<CatalogRow>;
}

export default function CatalogsTab() {
  const [rows, setRows] = useState<ReadonlyArray<CatalogRow>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string>('');
  const [pickedPayload, setPickedPayload] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<CatalogsResponse>('/api/admin/catalogs');
      setRows(res.catalogs ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load catalogs');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.size > 1_000_000) {
      setError('File exceeds 1MB cap.');
      return;
    }
    const text = await f.text();
    try {
      JSON.parse(text);
    } catch {
      setError('File is not valid JSON.');
      return;
    }
    setPickedName(f.name.replace(/\.json$/i, ''));
    setPickedPayload(text);
  }

  async function onUpload(): Promise<void> {
    if (!pickedPayload || !pickedName) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/catalogs', {
        method: 'POST',
        body: JSON.stringify({ name: pickedName, jsonPayload: pickedPayload }),
      });
      setPickedName('');
      setPickedPayload('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number): Promise<void> {
    if (!window.confirm('Delete this catalog?')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/catalogs/${id}`, { method: 'DELETE' });
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="admin-catalogs">
      <header className="admin-section__head">
        <p className="eyebrow">Pattern catalogs</p>
        <h2>Upload org-specific pattern catalogs</h2>
        <p className="admin-section__hint">
          Drop a JSON file. Stored payloads are visible to your org&rsquo;s developers.
          Catalogs do <strong>not</strong> drive the C++ parser yet — this is the
          dud-state staging area until the microservice learns to consume
          admin-uploaded catalogs.
        </p>
      </header>

      <div className="admin-catalog-upload">
        <label className="admin-catalog-field">
          <span>Catalog name</span>
          <input
            type="text"
            value={pickedName}
            onChange={(e) => setPickedName(e.target.value)}
            placeholder="e.g. acme-internal-patterns-v1"
            disabled={busy}
          />
        </label>
        <label className="admin-catalog-field">
          <span>JSON file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="ghost-btn"
          onClick={onUpload}
          disabled={busy || !pickedPayload || !pickedName}
        >
          {busy ? 'Uploading…' : 'Upload catalog'}
        </button>
      </div>

      {error && (
        <p className="admin-login-error" role="alert">{error}</p>
      )}

      <div className="admin-catalog-list">
        {rows.length === 0 && (
          <p className="admin-section__hint">No catalogs uploaded yet for this org.</p>
        )}
        {rows.map((r) => (
          <article key={r.id} className="admin-catalog-row">
            <div className="admin-catalog-row__main">
              <strong>{r.name}</strong>
              <span className="admin-catalog-row__meta">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <span
              className="admin-catalog-row__badge"
              data-active={r.is_active_in_parser ? 'true' : 'false'}
            >
              {r.is_active_in_parser
                ? 'Active in parser'
                : 'Stored, not yet routed to parser'}
            </span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onDelete(r.id)}
              disabled={busy}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
