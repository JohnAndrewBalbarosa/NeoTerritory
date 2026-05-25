import { useEffect, useState } from 'react';
import {
  fetchLearningAnalytics,
  setProficiencyBands,
  type LearningAnalytics,
  type ProficiencyBandDto,
} from '../../api/client';

// Admin "Learning" analytics: the objective pre/post learning measure the
// thesis panel asked for. Shows per-scope aggregates (avg pre, post, raw gain,
// Hake normalized gain <g>), a per-learner breakdown, and an editor for the
// professor-defined proficiency score ranges (validated by the statistician).

const SCOPE_ORDER = ['path', 'foundations', 'creational', 'structural', 'behavioural', 'idioms'] as const;
const SCOPE_LABELS: Record<string, string> = {
  path: 'Whole path',
  foundations: 'Foundations',
  creational: 'Creational',
  structural: 'Structural',
  behavioural: 'Behavioural',
  idioms: 'Idioms',
};

function fmtPct(n: number | undefined | null): string {
  return n == null ? '—' : `${n}%`;
}
function fmtGain(n: number | undefined | null): string {
  return n == null ? '—' : n.toFixed(2);
}

export default function LearningAnalyticsPanel() {
  const [data, setData] = useState<LearningAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Editable bands (local draft until saved).
  const [bands, setBands] = useState<ProficiencyBandDto[]>([]);
  const [savingBands, setSavingBands] = useState(false);
  const [bandsMsg, setBandsMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLearningAnalytics()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setBands(d.bands);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load learning analytics');
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  function updateBand(idx: number, patch: Partial<ProficiencyBandDto>): void {
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }
  function addBand(): void {
    setBands((prev) => [...prev, { min: 0, max: 0, label: 'New band' }]);
  }
  function removeBand(idx: number): void {
    setBands((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveBands(): Promise<void> {
    if (savingBands) return;
    setSavingBands(true);
    setBandsMsg(null);
    try {
      const res = await setProficiencyBands(bands);
      setBands(res.value);
      setBandsMsg('Saved.');
    } catch (err) {
      setBandsMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingBands(false);
    }
  }

  const aggregateScopes = data
    ? SCOPE_ORDER.filter((s) => data.aggregate[s] != null)
    : [];

  return (
    <div data-testid="learning-analytics-panel">
      <section className="admin-section admin-section--card">
        <header className="admin-section__head">
          <h2>Learning analytics — pre vs post</h2>
          <p className="admin-section__hint">
            Objective knowledge-test results from the learning path. Raw gain is
            post − pre (percentage points); ⟨g⟩ is the Hake normalized gain
            (post − pre) / (100 − pre), averaged over learners who finished both
            phases. This is the learning signal — not a Likert questionnaire.
          </p>
        </header>

        {!loaded && <p className="admin-section__hint">Loading…</p>}
        {error && <p className="admin-login-error" role="alert">{error}</p>}

        {loaded && !error && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Learners (both phases)</th>
                <th>Avg pre</th>
                <th>Avg post</th>
                <th>Avg raw gain</th>
                <th>Avg ⟨g⟩</th>
              </tr>
            </thead>
            <tbody>
              {aggregateScopes.length === 0 && (
                <tr><td colSpan={6}>No completed pre/post pairs yet.</td></tr>
              )}
              {aggregateScopes.map((s) => {
                const a = data!.aggregate[s];
                return (
                  <tr key={s}>
                    <td>{SCOPE_LABELS[s] ?? s}</td>
                    <td>{a.n}</td>
                    <td>{fmtPct(a.avgPre)}</td>
                    <td>{fmtPct(a.avgPost)}</td>
                    <td>{a.avgRawGain >= 0 ? '+' : ''}{a.avgRawGain} pts</td>
                    <td>{fmtGain(a.avgNormGain)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {loaded && !error && (
        <section className="admin-section admin-section--card">
          <header className="admin-section__head">
            <h2>Per-learner results</h2>
            <p className="admin-section__hint">
              Each learner’s pre → post per scope (raw gain · ⟨g⟩) and total
              practical attempts across modules.
            </p>
          </header>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Scope breakdown (pre → post · Δ · ⟨g⟩)</th>
                <th>Practical attempts</th>
              </tr>
            </thead>
            <tbody>
              {(data?.learners.length ?? 0) === 0 && (
                <tr><td colSpan={3}>No assessment submissions yet.</td></tr>
              )}
              {data?.learners.map((l) => (
                <tr key={l.userId}>
                  <td>{l.username || l.email || `user ${l.userId}`}</td>
                  <td>
                    <ul className="admin-learn-scopes">
                      {SCOPE_ORDER.filter((s) => l.scopes[s]).map((s) => {
                        const c = l.scopes[s];
                        return (
                          <li key={s}>
                            <strong>{SCOPE_LABELS[s] ?? s}:</strong> {fmtPct(c.pre)} → {fmtPct(c.post)}
                            {c.rawGain != null && (
                              <> · {c.rawGain >= 0 ? '+' : ''}{c.rawGain} pts</>
                            )}
                            {c.normGain != null && <> · ⟨g⟩ {c.normGain.toFixed(2)}</>}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td>{l.totalTries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="admin-section admin-section--card">
        <header className="admin-section__head">
          <h2>Proficiency bands</h2>
          <p className="admin-section__hint">
            Score ranges (percent) → proficiency label. The supervising
            professor sets these cut scores; the statistician validates them.
            Bands are shown to learners on their result and used to classify
            scores here. Saved values are clamped to 0–100 and sorted ascending.
          </p>
        </header>
        <ul className="admin-bands-editor">
          {bands.map((b, i) => (
            <li key={i} className="admin-bands-row">
              <label>
                <span>Min</span>
                <input
                  type="number" min={0} max={100} value={b.min}
                  onChange={(e) => updateBand(i, { min: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Max</span>
                <input
                  type="number" min={0} max={100} value={b.max}
                  onChange={(e) => updateBand(i, { max: Number(e.target.value) })}
                />
              </label>
              <label className="admin-bands-label">
                <span>Label</span>
                <input
                  type="text" value={b.label}
                  onChange={(e) => updateBand(i, { label: e.target.value })}
                />
              </label>
              <button type="button" className="ghost-btn" onClick={() => removeBand(i)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="admin-bands-actions">
          <button type="button" className="ghost-btn" onClick={addBand}>+ Add band</button>
          <button type="button" className="primary-btn" onClick={() => void saveBands()} disabled={savingBands}>
            {savingBands ? 'Saving…' : 'Save bands'}
          </button>
          {bandsMsg && <span className="admin-section__hint">{bandsMsg}</span>}
        </div>
      </section>
    </div>
  );
}
