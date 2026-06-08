import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminSettings,
  previewFeatureReleasePlan,
  setFeatureReleases,
  type AdminSettings,
} from '../../api/client';
import { FEATURE_FLAGS } from '../../data/featureRegistry';
import type {
  AdminFeatureReleasePlan,
  AdminFeatureReleaseToggleDecision,
} from '../../types/api';

// Prompt-driven feature-release policy editor.
// Default state is OFF (implicit deny).
// Toggles are only updated on explicit confirm.
export default function FeatureReleasePanel() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [promptText, setPromptText] = useState('');
  const [plan, setPlan] = useState<AdminFeatureReleasePlan | null>(null);
  const [planState, setPlanState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  const offMap = useMemo(() => {
    const out: Record<string, boolean> = {};
    FEATURE_FLAGS.forEach((flag) => {
      out[flag.key] = false;
    });
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminSettings()
      .then((s: AdminSettings) => {
        if (cancelled) return;
        setMap({ ...offMap, ...(s.feature_releases || {}) });
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load feature releases');
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [offMap]);

  useEffect(() => {
    const prompt = promptText.trim();
    if (!prompt) {
      setPlan(null);
      setPlanState('idle');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setPlanState('loading');
      previewFeatureReleasePlan({
        prompt,
        featureFlags: FEATURE_FLAGS.map((flag) => ({
          key: flag.key,
          label: flag.label,
          description: flag.description,
        })),
      })
        .then((nextPlan) => {
          if (cancelled) return;
          setPlan(nextPlan);
          setPlanState('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setPlan(null);
          setPlanState('failed');
        });
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [promptText]);

  const previewList = useMemo<Array<AdminFeatureReleaseToggleDecision & { current: boolean }>>(() => {
    const planned = new Map((plan?.toggles || []).map((toggle) => [toggle.key, toggle]));
    return FEATURE_FLAGS.map((flag) => {
      const chosen = planned.get(flag.key);
      return {
        key: flag.key,
        label: flag.label,
        current: map[flag.key] ?? false,
        enabled: chosen?.enabled ?? false,
        reason: chosen?.reason ?? 'No AI plan yet. Defaults to OFF.',
        matchedModules: chosen?.matchedModules ?? [],
        matchedTopics: chosen?.matchedTopics ?? [],
      };
    });
  }, [plan, map]);

  async function savePolicy(nextMap: Record<string, boolean>): Promise<void> {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await setFeatureReleases(nextMap);
      setMap({ ...offMap, ...(res.value || {}) });
      setPromptText('');
      setPlan(null);
      setPlanState('idle');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const applyPreview = () => {
    const nextMap = { ...map };
    previewList.forEach((item) => {
      nextMap[item.key] = item.enabled;
    });
    savePolicy(nextMap);
  };

  async function toggleManual(key: string, next: boolean): Promise<void> {
    const optimistic = { ...map, [key]: next };
    setMap(optimistic);
    try {
      await setFeatureReleases(optimistic);
    } catch (err: unknown) {
      fetchAdminSettings().then((s) => setMap({ ...offMap, ...(s.feature_releases || {}) }));
      setError(err instanceof Error ? err.message : 'Manual toggle save failed');
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="feature-release-panel">
      <header className="admin-section__head">
        <h2>Feature releases</h2>
        <p className="admin-section__hint">
          Prompt-driven deployment gate. Default state is <strong>OFF</strong> until the AI plan says otherwise.
          The prompt uses the same provider configuration as the auto-documentation flow.
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
              placeholder="Describe the project architecture, business flow, and what should be enabled or hidden."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <div className="admin-prompt-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setPromptText('');
                  setPlan(null);
                  setPlanState('idle');
                }}
                disabled={!promptText}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="admin-policy-preview">
            <h3>AI plan</h3>
            {planState === 'loading' && (
              <p className="admin-section__hint">Generating JSON plan from the prompt and module catalog&hellip;</p>
            )}
            {planState === 'failed' && (
              <p className="admin-login-error" role="alert">
                AI preview failed. The panel is still safe default-off until a valid plan arrives.
              </p>
            )}
            {plan && (
              <>
                <p className="admin-section__hint">{plan.summary}</p>
                <div className="admin-plan-scope">
                  <h4>Required modules</h4>
                  {plan.requiredLearning.length === 0 ? (
                    <p className="admin-section__hint">No module scope was required by the AI plan.</p>
                  ) : (
                    <ul className="admin-scope-list">
                      {plan.requiredLearning.map((mod) => (
                        <li key={mod.moduleId} className="admin-scope-card">
                          <strong>{mod.title}</strong>
                          <p>{mod.reason}</p>
                          <div className="admin-scope-meta">
                            <span>{mod.category}</span>
                            <span>{mod.sections.length} sections</span>
                            <span>{mod.topics.length} topics</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            <h3>Toggle preview</h3>
            <ul className="admin-feature-list">
              {previewList.map((item) => (
                <li
                  key={item.key}
                  className={`admin-feature-row admin-feature-row--preview${item.current === item.enabled ? '' : ' is-changed'}`}
                >
                  <div className="admin-feature-row__meta">
                    <p className="admin-feature-row__label">{item.label}</p>
                    <p className="admin-feature-row__explanation">{item.reason}</p>
                    {item.matchedModules.length > 0 && (
                      <p className="admin-feature-row__desc">
                        Modules: {item.matchedModules.join(', ')}
                      </p>
                    )}
                    {item.matchedTopics.length > 0 && (
                      <p className="admin-feature-row__desc">
                        Topics: {item.matchedTopics.slice(0, 6).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="admin-feature-row__delta">
                    <span className={`tag ${item.current ? 'tag--on' : 'tag--off'}`}>
                      {item.current ? 'ON' : 'OFF'}
                    </span>
                    <span className="arrow">→</span>
                    <span className={`tag ${item.enabled ? 'tag--on' : 'tag--off'}`}>
                      {item.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="ghost-btn admin-policy-confirm"
              disabled={saving || !plan}
              onClick={applyPreview}
            >
              {saving ? 'Saving...' : 'Confirm and Save Changes'}
            </button>
          </div>

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
