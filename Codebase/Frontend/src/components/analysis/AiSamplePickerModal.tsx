import { useEffect, useMemo, useState } from 'react';
import { fetchAiSamplePatterns, generateAiSample, type AiSamplePattern } from '../../api/client';

// Panelist-only AI sample generator (feature 'panelist-ai-sample'). The
// panelist picks a catalog pattern; the backend injects that pattern's JSON
// into the AI prompt and returns a fresh C++ sample, which the studio loads
// into the editor. Visible only when the feature toggle is ON (gated by the
// caller) — and clearly labelled for-defense-testing use.
interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: (filename: string, code: string) => void;
}

export default function AiSamplePickerModal({ open, onClose, onGenerated }: Props) {
  const [patterns, setPatterns] = useState<AiSamplePattern[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loadingList, setLoadingList] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLoadingList(true);
    fetchAiSamplePatterns()
      .then((p) => {
        setPatterns(p);
        if (p.length > 0 && !selected) setSelected(p[0].patternId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load patterns.'))
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grouped = useMemo(() => {
    const byFamily: Record<string, AiSamplePattern[]> = {};
    for (const p of patterns) (byFamily[p.family] ||= []).push(p);
    return byFamily;
  }, [patterns]);

  if (!open) return null;

  async function onGenerate(): Promise<void> {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await generateAiSample(selected);
      if (!r.code?.trim()) {
        setError('The AI returned no code. Try again or pick another pattern.');
        return;
      }
      onGenerated(r.filename || `${selected}_ai_sample.cpp`, r.code);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nt-sample-picker" role="dialog" aria-modal="true" aria-labelledby="ai-sample-title">
      <div className="nt-sample-picker__backdrop" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div className="nt-sample-picker__panel" role="document" data-testid="ai-sample-modal">
        <header className="nt-sample-picker__head">
          <div>
            <p className="nt-sample-picker__eyebrow">Panelist use only</p>
            <h2 id="ai-sample-title" className="nt-sample-picker__title">
              Generate a sample with AI
            </h2>
            <p className="nt-sample-picker__lede">
              For testing during the defense only. Pick a design pattern — the analyser&rsquo;s own
              catalog definition is injected into the AI prompt, and the generated C++ sample is
              placed in the editor.
            </p>
          </div>
          <button type="button" className="nt-sample-picker__close" onClick={onClose} aria-label="Close" disabled={busy}>
            ×
          </button>
        </header>

        <div className="nt-sample-picker__body">
          {loadingList ? (
            <p className="nt-sample-picker__empty">Loading patterns…</p>
          ) : patterns.length === 0 ? (
            <p className="nt-sample-picker__empty">No catalog patterns available.</p>
          ) : (
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Design pattern</span>
              <select
                data-testid="ai-sample-pattern-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={busy}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                {(['creational', 'structural', 'behavioural', 'idiom'] as const)
                  .filter((f) => grouped[f]?.length)
                  .map((f) => (
                    <optgroup key={f} label={f[0].toUpperCase() + f.slice(1)}>
                      {grouped[f].map((p) => (
                        <option key={p.patternId} value={p.patternId}>
                          {p.patternName} ({p.patternId})
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </label>
          )}

          {error ? (
            <p className="nt-sample-picker__empty" role="alert" data-testid="ai-sample-error" style={{ color: 'var(--color-danger, #c0392b)' }}>
              {error}
            </p>
          ) : null}
        </div>

        <footer className="form-actions" style={{ padding: '1rem' }}>
          <button
            type="button"
            className="primary-btn"
            data-testid="ai-sample-generate-btn"
            onClick={() => void onGenerate()}
            disabled={busy || !selected || patterns.length === 0}
          >
            {busy ? 'Generating…' : 'Generate sample'}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
