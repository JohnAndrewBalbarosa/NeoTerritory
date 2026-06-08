import { useEffect, useState, useMemo } from 'react';
import {
  fetchAdminSettings,
  setFeatureReleases,
  type AdminSettings,
} from '../../api/client';
import { FEATURE_FLAGS } from '../../data/featureRegistry';

interface TogglePreview {
  key: string;
  label: string;
  current: boolean;
  next: boolean;
  explanation: string;
}

// Prompt-driven feature-release policy editor.
// Default state is OFF (implicit deny).
// Toggles are only updated on explicit confirm.
export default function FeatureReleasePanel() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [promptText, setPromptText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Initialize all flags as OFF by default
  const offMap = useMemo(() => {
    const out: Record<string, boolean> = {};
    FEATURE_FLAGS.forEach(f => out[f.key] = false);
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminSettings()
      .then((s: AdminSettings) => {
        if (cancelled) return;
        // Merge: Default OFF < Persistent state
        setMap({ ...offMap, ...(s.feature_releases || {}) });
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load feature releases');
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [offMap]);

  const previewList = useMemo<TogglePreview[]>(() => {
    if (!promptText.trim()) return [];

    const p = promptText.toLowerCase();
    return FEATURE_FLAGS.map(flag => {
      let next = map[flag.key] ?? false;
      let explanation = "No change inferred.";

      const includesFlag = p.includes(flag.key.toLowerCase()) || p.includes(flag.label.toLowerCase());
      const isEnable = p.includes('enable') || p.includes('on') || p.includes('show') || p.includes('release');
      const isDisable = p.includes('disable') || p.includes('off') || p.includes('hide');

      if (includesFlag) {
        if (isEnable) {
          next = true;
          explanation = `Prompt mentions "${flag.label}" and an enable command.`;
        } else if (isDisable) {
          next = false;
          explanation = `Prompt mentions "${flag.label}" and a disable command.`;
        }
      } else if (p.includes('enable all') || p.includes('release all') || p.includes('show all')) {
        next = true;
        explanation = 'Global enable command detected.';
      } else if (p.includes('disable all') || p.includes('hide all') || p.includes('off all')) {
        next = false;
        explanation = 'Global disable command detected.';
      }

      return {
        key: flag.key,
        label: flag.label,
        current: map[flag.key] ?? false,
        next,
        explanation
      };
    });
  }, [promptText, map]);

  async function savePolicy(nextMap: Record<string, boolean>): Promise<void> {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await setFeatureReleases(nextMap);
      setMap({ ...offMap, ...(res.value || {}) });
      setShowPreview(false);
      setPromptText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const applyPreview = () => {
    const nextMap = { ...map };
    previewList.forEach(p => {
      nextMap[p.key] = p.next;
    });
    savePolicy(nextMap);
  };

  async function toggleManual(key: string, next: boolean): Promise<void> {
    const optimistic = { ...map, [key]: next };
    setMap(optimistic);
    try {
      await setFeatureReleases(optimistic);
    } catch (err: unknown) {
      // Revert on error
      fetchAdminSettings().then(s => setMap({ ...offMap, ...(s.feature_releases || {}) }));
      setError(err instanceof Error ? err.message : 'Manual toggle save failed');
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="feature-release-panel">
      <header className="admin-section__head">
        <h2>Feature releases</h2>
        <p className="admin-section__hint">
          Prompt-driven deployment gate. Default state is <strong>OFF</strong>.
          Use the prompt to preview changes before confirming.
        </p>
      </header>

      {!loaded && <p className="admin-section__hint">Loading feature flags&hellip;</p>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {loaded && (
        <div className="admin-policy-editor">
          <div className="admin-prompt-box">
            <label htmlFor="feature-prompt">Policy Prompt</label>
            <textarea
              id="feature-prompt"
              placeholder="e.g. 'Enable student-learning and hide pm-accounts'"
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                setShowPreview(true);
              }}
            />
            <div className="admin-prompt-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => { setPromptText(''); setShowPreview(false); }}
                disabled={!promptText}
              >
                Clear
              </button>
            </div>
          </div>

          {showPreview && previewList.length > 0 && (
            <div className="admin-policy-preview">
              <h3>Preview Changes</h3>
              <ul className="admin-feature-list">
                {previewList.filter(p => p.current !== p.next).map(p => (
                  <li key={p.key} className="admin-feature-row admin-feature-row--preview">
                    <div className="admin-feature-row__meta">
                      <p className="admin-feature-row__label">{p.label}</p>
                      <p className="admin-feature-row__explanation">{p.explanation}</p>
                    </div>
                    <div className="admin-feature-row__delta">
                      <span className={`tag ${p.current ? 'tag--on' : 'tag--off'}`}>
                        {p.current ? 'ON' : 'OFF'}
                      </span>
                      <span className="arrow">→</span>
                      <span className={`tag ${p.next ? 'tag--on' : 'tag--off'}`}>
                        {p.next ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </li>
                ))}
                {previewList.every(p => p.current === p.next) && (
                  <li className="admin-section__hint">No changes inferred from prompt.</li>
                )}
              </ul>
              <button
                type="button"
                className="ghost-btn admin-policy-confirm"
                disabled={saving || previewList.every(p => p.current === p.next)}
                onClick={applyPreview}
              >
                {saving ? 'Saving...' : 'Confirm and Save Changes'}
              </button>
            </div>
          )}

          <div className="admin-manual-overrides">
            <h3>Current State / Manual Overrides</h3>
            <ul className="admin-feature-list">
              {FEATURE_FLAGS.map((flag) => {
                const on = map[flag.key] === true;
                return (
                  <li key={flag.key} className="admin-feature-row" data-released={on ? 'true' : 'false'}>
                    <div className="admin-feature-row__meta">
                      <p className="admin-feature-row__label">{flag.label}</p>
                      <p className="admin-feature-row__key"><code>{flag.key}</code></p>
                      <p className="admin-feature-row__desc">{flag.description}</p>
                    </div>
                    <button
                      type="button"
                      className={`admin-feature-row__toggle${on ? ' is-on' : ''}`}
                      onClick={() => toggleManual(flag.key, !on)}
                      aria-pressed={on}
                    >
                      {on ? 'Released' : 'Hidden'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
