import { useEffect, useState } from 'react';
import {
  fetchAdminSettings,
  setFeatureReleases,
  type AdminSettings,
} from '../../api/client';
import { FEATURE_FLAGS, defaultReleaseMap } from '../../data/featureRegistry';

// Developer-side feature-release admin. Lists every flag in
// featureRegistry.ts with an on/off toggle. The map is persisted via
// PUT /api/admin/settings/feature_releases and re-published to public
// clients through /auth/test-accounts → useFeatureReleases.
export default function FeatureReleasePanel() {
  const [map, setMap] = useState<Record<string, boolean>>(defaultReleaseMap());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminSettings()
      .then((s: AdminSettings) => {
        if (cancelled) return;
        setMap({ ...defaultReleaseMap(), ...(s.feature_releases || {}) });
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load feature releases');
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  async function toggle(key: string, next: boolean): Promise<void> {
    if (saving) return;
    setSaving(key);
    setError(null);
    const optimistic = { ...map, [key]: next };
    setMap(optimistic);
    try {
      const res = await setFeatureReleases(optimistic);
      setMap({ ...defaultReleaseMap(), ...(res.value || {}) });
    } catch (err: unknown) {
      setMap(map);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="admin-section admin-section--card" data-testid="feature-release-panel">
      <header className="admin-section__head">
        <h2>Feature releases</h2>
        <p className="admin-section__hint">
          Per-feature visibility for the public frontend. Off = hidden from
          everyone (default for unposted work). On = the feature ships sa
          live site. Changes take effect on next page load.
        </p>
      </header>

      {!loaded && <p className="admin-section__hint">Loading feature flags&hellip;</p>}
      {error && <p className="admin-login-error" role="alert">{error}</p>}

      {loaded && (
        <ul className="admin-feature-list">
          {FEATURE_FLAGS.map((flag) => {
            const on = map[flag.key] === true;
            const busy = saving === flag.key;
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
                  onClick={() => toggle(flag.key, !on)}
                  disabled={busy}
                  aria-pressed={on}
                  data-testid={`feature-toggle-${flag.key}`}
                >
                  {busy ? 'Saving…' : on ? 'Released' : 'Hidden'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
