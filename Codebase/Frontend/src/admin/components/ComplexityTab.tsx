import { useEffect, useState } from 'react';
import { fetchAdminComplexityData, fetchAdminCronbach, fetchAdminF1Metrics, type CronbachData } from '../../api/client';
import { ComplexityData, F1Metrics, ComplexityPoint, RegressionResult } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

// ─── Line chart (token-sorted, with regression overlay) ─────────────────────

const SVG_W = 480, SVG_H = 240, PAD = 48;


// Generic scatter+regression chart for any (x, y) pair on the points array.
// Used by the space-vs-tokens panel and the server wall-time panel so the
// thesis dashboard renders identical-styled graphs side by side.
function GenericRegressionChart({ points, regression, xKey, yKey, xLabel, yLabel, ariaLabel }: {
  points: ComplexityPoint[];
  regression: RegressionResult;
  xKey: keyof ComplexityPoint;
  yKey: keyof ComplexityPoint;
  xLabel: string;
  yLabel: string;
  ariaLabel: string;
}) {
  const usable = points.filter((p) => typeof p[xKey] === 'number' && typeof p[yKey] === 'number' && (p[xKey] as number) > 0 && (p[yKey] as number) > 0);
  if (usable.length === 0) return <div className="empty-state">No data yet for {ariaLabel}.</div>;

  const sorted = [...usable].sort((a, b) => (a[xKey] as number) - (b[xKey] as number));
  const xMin = 0;
  const xMax = Math.max(...sorted.map((p) => p[xKey] as number), 1);
  const yMin = 0;
  const yMax = Math.max(...sorted.map((p) => p[yKey] as number), 1);

  function tx(v: number) { return PAD + ((v - xMin) / (xMax - xMin)) * (SVG_W - PAD * 2); }
  function ty(v: number) { return SVG_H - PAD - ((v - yMin) / (yMax - yMin)) * (SVG_H - PAD * 2); }

  const polyPts = sorted.map((p) => `${tx(p[xKey] as number)},${ty(p[yKey] as number)}`).join(' ');
  const regY1 = Math.max(yMin, Math.min(yMax, regression.slope * xMin + regression.intercept));
  const regY2 = Math.max(yMin, Math.min(yMax, regression.slope * xMax + regression.intercept));
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="complexity-scatter" aria-label={ariaLabel}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round(xMin + (i / ticks) * (xMax - xMin));
        const x = tx(v);
        return (
          <g key={`xg${i}`}>
            <line x1={x} y1={PAD / 2} x2={x} y2={SVG_H - PAD} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x} y={SVG_H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round((yMin + (i / ticks) * (yMax - yMin)) * 100) / 100;
        const y = ty(v);
        return (
          <g key={`yg${i}`}>
            <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="#aaa" strokeWidth="1" />
            <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />
      <line x1={PAD} y1={SVG_H - PAD} x2={SVG_W - PAD / 2} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />
      <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fontSize="10" fill="#666">{xLabel}</text>
      <text x={12} y={SVG_H / 2} textAnchor="middle" fontSize="10" fill="#666"
        transform={`rotate(-90 12 ${SVG_H / 2})`}>{yLabel}</text>
      <polyline points={polyPts} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" />
      <line x1={tx(xMin)} y1={ty(regY1)} x2={tx(xMax)} y2={ty(regY2)}
        stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
      {sorted.map((p) => (
        <circle key={p.runId} cx={tx(p[xKey] as number)} cy={ty(p[yKey] as number)} r={3}
          fill="#16a34a" stroke="white" strokeWidth="1">
          <title>Run {p.runId}: x={p[xKey]} y={p[yKey]}</title>
        </circle>
      ))}
      <line x1={SVG_W - 130} y1={18} x2={SVG_W - 112} y2={18} stroke="#16a34a" strokeWidth="2" />
      <text x={SVG_W - 108} y={21} fontSize="9" fill="#555">actual</text>
      <line x1={SVG_W - 70} y1={18} x2={SVG_W - 52} y2={18} stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={SVG_W - 48} y={21} fontSize="9" fill="#555">regression</text>
    </svg>
  );
}


// ─── F1 table ─────────────────────────────────────────────────────────────────

function F1Badge({ value }: { value: number }) {
  const color = value >= 0.7 ? '#10b981' : value >= 0.5 ? '#f59e0b' : '#ef4444';
  return <span className="f1-badge" style={{ color }}>{(value * 100).toFixed(1)}%</span>;
}

// ─── ComplexityTab ────────────────────────────────────────────────────────────

export default function ComplexityTab() {
  const [complexity, setComplexity] = useState<ComplexityData | null>(null);
  const [cron, setCron] = useState<CronbachData | null>(null);
  const [f1, setF1] = useState<F1Metrics | null>(null);
  // Test-summary card was relocated to the Runs tab so the panel sees
  // run count + compile/static/unit pass rates next to the run list.
  const [cErr, setCErr] = useState<string | null>(null);
  const [fErr, setFErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminComplexityData()
      .then(setComplexity)
      .catch(e => { if (!isAuthError(e)) setCErr(e.message); });
    fetchAdminCronbach()
      .then(setCron)
      .catch(() => { /* optional panel — silent on miss */ });
    fetchAdminF1Metrics()
      .then(setF1)
      .catch(e => { if (!isAuthError(e)) setFErr(e.message); });
    // (test-summary fetch moved to RunsTab)
  }, []);

  return (
    <div className="admin-complexity-tab">

      {cron && (
        <section className="admin-section">
          <h2>Cronbach&apos;s α — Internal-consistency reliability</h2>
          <p className="empty-state-muted">
            Per-respondent rolled-up Likert ratings (per-run items B.3-B.7
            collapsed to mean before α). Live from <code>session_feedback</code>
            and <code>run_feedback</code>. n = {cron.totalRespondents} respondents.
          </p>
          <table className="complexity-coef-table">
            <thead>
              <tr>
                <th>Subscale</th>
                <th>k (items)</th>
                <th>n (respondents)</th>
                <th>α</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {cron.subscales.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td><code>{s.k}</code></td>
                  <td><code>{s.n}</code></td>
                  <td><code style={{ color: s.alpha >= 0.7 ? '#10b981' : s.alpha >= 0.6 ? '#f59e0b' : '#ef4444' }}>{s.alpha.toFixed(4)}</code></td>
                  <td>{s.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="f1-note-footnote">{cron.methodologyNote}</p>
        </section>
      )}

      {cErr && <section className="admin-section"><div className="empty-state admin-error" role="alert">{cErr}</div></section>}
      {!complexity && !cErr && <div className="empty-state">Loading…</div>}

      {complexity?.regressionSpaceKbByTokens && (
        <section className="admin-section">
          <GenericRegressionChart
            points={complexity.points}
            regression={complexity.regressionSpaceKbByTokens}
            xKey="tokens"
            yKey="analysisKb"
            xLabel="Tokens"
            yLabel="KB"
            ariaLabel="analysis-json kilobytes vs tokens"
          />
          <h2>Space complexity — Serialized analysis (KB) vs token count</h2>
          <p className="empty-state-muted">
            y-axis: byte size of the <code>analysis_json</code> the server emitted for the run,
            expressed in KB. This is the exact in-memory image (structural rep + detected
            patterns + per-pattern documentation/test targets) the analyzer held just before
            serialization. x-axis: token count. Validates the O(n) <em>space</em> claim with a
            real memory unit instead of an item-count proxy.
          </p>
          <table className="complexity-coef-table">
            <tbody>
              <tr><td>Slope</td><td><code>{complexity.regressionSpaceKbByTokens.slope} KB/token</code></td></tr>
              <tr><td>Intercept</td><td><code>{complexity.regressionSpaceKbByTokens.intercept} KB</code></td></tr>
              <tr><td>R²</td><td><code>{complexity.regressionSpaceKbByTokens.r2}</code></td></tr>
              <tr><td>n</td><td><code>{complexity.regressionSpaceKbByTokens.n} runs</code></td></tr>
              <tr><td>Interpretation</td><td>{complexity.regressionSpaceKbByTokens.interpretation}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {complexity?.regressionSpaceByTokens && (
        <section className="admin-section">
          <h2>Algorithm time complexity — Operations vs token count</h2>
          <p className="empty-state-muted">
            y-axis: sum of <code>items_processed</code> across stages — the literal count of
            operations the analyzer&apos;s inner loop performs. x-axis: token count of the
            submission. <strong>Immune to job scheduling and CPU contention</strong> because
            operation counts are deterministic given a fixed input — wall-clock noise cannot
            reach this metric. Validates the O(n) <em>time</em> claim regardless of server load.
            Cross-validated by the regression-validation test sa{' '}
            <code>Codebase/Backend/src/__tests__/algorithm-complexity.test.ts</code>.
          </p>
          <table className="complexity-coef-table">
            <tbody>
              <tr><td>Slope</td><td><code>{complexity.regressionSpaceByTokens.slope} ops/token</code></td></tr>
              <tr><td>Intercept</td><td><code>{complexity.regressionSpaceByTokens.intercept} ops</code></td></tr>
              <tr><td>R²</td><td><code>{complexity.regressionSpaceByTokens.r2}</code></td></tr>
              <tr><td>n</td><td><code>{complexity.regressionSpaceByTokens.n} runs</code></td></tr>
              <tr><td>Interpretation</td><td>{complexity.regressionSpaceByTokens.interpretation}</td></tr>
            </tbody>
          </table>
          <p className="empty-state-muted" style={{ marginTop: '0.75rem' }}>
            Same regression also serves the O(n) <em>space</em> claim — each
            <code> items_processed</code> entry ≈ one structural-rep node held in RAM during
            analysis, at near-constant bytes per item.
          </p>
        </section>
      )}

      <section className="admin-section">
        <h2>F1 metrics</h2>
        {fErr && <div className="empty-state admin-error" role="alert">{fErr}</div>}
        {f1 && (
          <>
            <table className="f1-pattern-table f1-overall-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1</th>
                  <th>TP</th>
                  <th>FP</th>
                  <th>FN</th>
                  <th title="True negatives — user said 'no pattern here' AND the system also detected nothing. Overall only; per-pattern TN is not meaningful (see DESIGN_DECISIONS D36).">TN</th>
                </tr>
              </thead>
              <tbody>
                <tr className="f1-overall-row">
                  <td><strong>Overall (actual)</strong></td>
                  <td><F1Badge value={f1.overall.precision} /></td>
                  <td><F1Badge value={f1.overall.recall} /></td>
                  <td><F1Badge value={f1.overall.f1} /></td>
                  <td>{f1.overall.tp}</td>
                  <td>{f1.overall.fp}</td>
                  <td>{f1.overall.fn}</td>
                  <td>{f1.overall.tn}</td>
                </tr>
                {f1.perPattern.map(p => (
                  <tr key={p.pattern} data-valid={p.valid !== false ? 'true' : 'false'}>
                    <td>
                      {p.pattern}
                      {p.valid === false && <span className="f1-row-flag" title="Insufficient data — informational only">⚠</span>}
                      {p.reasoning && (
                        <span className="f1-row-reason" title={p.reasoning}>
                          {p.reasoning}
                        </span>
                      )}
                    </td>
                    <td><F1Badge value={p.precision} /></td>
                    <td><F1Badge value={p.recall} /></td>
                    <td><F1Badge value={p.f1} /></td>
                    <td>{p.tp}</td>
                    <td>{p.fp}</td>
                    <td>{p.fn}</td>
                    <td title="Per-line per-pattern true negative: analyzer did NOT flag this pattern AND the participant did NOT pick it.">{p.tn}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="f1-integration-note">
              {f1.userAccuracyAvg !== null && <>User accuracy avg: <strong>{f1.userAccuracyAvg}/5</strong></>}
              {f1.likertF1Correlation !== null && <> · Likert↔F1 correlation: <strong>{f1.likertF1Correlation}</strong></>}
              {' '}<span className="f1-note-footnote">({f1.note})</span>
            </p>

            {f1.overall.reasoning && (
              <p className="f1-integration-note f1-overall-reasoning" data-testid="f1-overall-reasoning">
                <strong>Verdict:</strong> {f1.overall.reasoning}
              </p>
            )}
          </>
        )}
        {!f1 && !fErr && <div className="empty-state">Loading…</div>}
      </section>

    </div>
  );
}
