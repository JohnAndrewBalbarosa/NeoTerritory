import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminSettings,
  setFeatureReleases,
  type AdminSettings,
} from '../../api/client';
import { FEATURE_FLAGS } from '../../data/featureRegistry';

// Plain feature-release toggle editor.
// Default state is OFF (implicit deny).
export default function FeatureReleasePanel() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Manual release gate. Default state is <strong>OFF</strong> until you explicitly flip a flag on.
        </p>
      </header>

      {!loaded && <p className="admin-section__hint">Loading feature flags&hellip;</p>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {loaded && (
        <div className="admin-policy-editor">
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
