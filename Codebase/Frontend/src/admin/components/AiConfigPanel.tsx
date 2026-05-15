import { useEffect, useState } from 'react';
import {
  fetchAdminAiConfig,
  saveAdminAiConfig,
  type AdminAiConfig,
  type AdminAiProvider,
} from '../../api/client';

// Admin form for the runtime AI provider configuration. Persists to the
// `ai_config` SQLite row (API key encrypted at rest, see db/aiConfig.ts).
// pickProvider() in the AI service consults this row first, so saving here
// hot-swaps the active provider without a redeploy. Env vars remain the
// fallback when the row is unset / cleared.

const PROVIDER_OPTIONS: Array<{ value: AdminAiProvider; label: string; defaultModel: string; placeholder: string }> = [
  { value: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-6', placeholder: 'sk-ant-...' },
  { value: 'gemini',    label: 'Google Gemini',     defaultModel: 'gemini-2.5-flash',   placeholder: 'AIza...' },
  { value: 'none',      label: 'None (disable AI)', defaultModel: '',                   placeholder: '' },
];

export default function AiConfigPanel() {
  const [snap, setSnap] = useState<AdminAiConfig | null>(null);
  const [provider, setProvider] = useState<AdminAiProvider>('none');
  const [model, setModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function applySnapshot(s: AdminAiConfig): void {
    setSnap(s);
    setProvider(s.provider);
    setModel(s.model);
    setApiKey('');
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminAiConfig()
      .then((s) => { if (!cancelled) applySnapshot(s); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  async function onSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const opt = PROVIDER_OPTIONS.find((o) => o.value === provider);
      const finalModel = provider === 'none' ? '' : (model.trim() || opt?.defaultModel || '');
      const next = await saveAdminAiConfig({
        provider,
        model: finalModel,
        // Only send apiKey when the operator typed something. Empty input
        // when there's already a key on the server means "keep existing".
        ...(apiKey.length > 0 ? { apiKey } : {}),
      });
      applySnapshot(next);
      setSuccess(
        provider === 'none'
          ? 'AI disabled. Environment-variable fallback re-engaged.'
          : `Saved. ${next.hasKey ? 'Key stored (encrypted).' : 'No key set yet.'}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const selectedOption = PROVIDER_OPTIONS.find((o) => o.value === provider);
  const needsKey = provider !== 'none';
  const keyAlreadyOnServer = snap?.hasKey === true && snap.provider === provider;

  return (
    <form className="admin-ai-config" onSubmit={onSave}>
      <div className="admin-ai-config__grid">
        <label className="admin-field">
          <span className="admin-field__label">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AdminAiProvider)}
            disabled={busy}
            className="admin-field__input"
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="admin-field__hint">
            {provider === 'none'
              ? 'Disables runtime AI. Pattern detection still works without it.'
              : 'Provider is honoured by the documentation + commentary jobs.'}
          </span>
        </label>

        <label className="admin-field" hidden={provider === 'none'}>
          <span className="admin-field__label">Model</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy || provider === 'none'}
            placeholder={selectedOption?.defaultModel || ''}
            className="admin-field__input"
          />
          <span className="admin-field__hint">
            Leave blank to use the default ({selectedOption?.defaultModel || '—'}).
          </span>
        </label>

        <label className="admin-field admin-field--span" hidden={provider === 'none'}>
          <span className="admin-field__label">
            API key
            {keyAlreadyOnServer && (
              <span className="admin-field__chip">a key is currently stored</span>
            )}
          </span>
          <div className="admin-field__row">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={busy || provider === 'none'}
              placeholder={keyAlreadyOnServer ? 'Leave blank to keep existing key' : selectedOption?.placeholder || ''}
              className="admin-field__input"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowKey((v) => !v)}
              disabled={busy}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="admin-field__hint">
            Stored encrypted at rest (AES-256-GCM). The server never echoes the key back —
            blank input means &ldquo;keep what&rsquo;s saved&rdquo;.
          </span>
        </label>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {success && <div className="admin-success-banner" role="status">{success}</div>}

      <div className="admin-ai-config__actions">
        <button
          type="submit"
          className="primary-btn"
          disabled={busy || (needsKey && !keyAlreadyOnServer && apiKey.length === 0)}
        >
          {busy ? 'Saving…' : provider === 'none' ? 'Disable AI' : 'Save configuration'}
        </button>
        {snap?.updatedAt && (
          <span className="admin-ai-config__meta">
            Last updated {new Date(snap.updatedAt + 'Z').toLocaleString()}
            {snap.updatedBy ? ` by ${snap.updatedBy}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}
