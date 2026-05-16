import { useEffect, useState } from 'react';
import { fetchAdminComplexityData, fetchAdminComplexityLocal, fetchAdminF1Metrics, type LocalSweepData } from '../../api/client';
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

// Local-sweep chart: x-axis N (input lines), y-axis the chosen field
// (wall_ms or peak_kb). Uses median-per-N points so 5 reps per N don't
// produce visual clutter.
function LocalSweepChart({ points, yKey, yLabel, regression, ariaLabel }: {
  points: Array<{ N: number; wall_ms: number; peak_kb: number }>;
  yKey: 'wall_ms' | 'peak_kb';
  yLabel: string;
  regression: RegressionResult;
  ariaLabel: string;
}) {
  if (points.length === 0) return <div className="empty-state">No local sweep data available.</div>;
  const sorted = [...points].sort((a, b) => a.N - b.N);
  const xMin = 0;
  const xMax = Math.max(...sorted.map((p) => p.N), 1);
  const yMin = 0;
  const yMax = Math.max(...sorted.map((p) => p[yKey]), 1);
  function tx(v: number) { return PAD + ((v - xMin) / (xMax - xMin)) * (SVG_W - PAD * 2); }
  function ty(v: number) { return SVG_H - PAD - ((v - yMin) / (yMax - yMin)) * (SVG_H - PAD * 2); }
  const polyPts = sorted.map((p) => `${tx(p.N)},${ty(p[yKey])}`).join(' ');
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
        const v = Math.round((yMin + (i / ticks) * (yMax - yMin)));
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
      <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fontSize="10" fill="#666">N (lines of synthesized C++)</text>
      <text x={12} y={SVG_H / 2} textAnchor="middle" fontSize="10" fill="#666"
        transform={`rotate(-90 12 ${SVG_H / 2})`}>{yLabel}</text>
      <polyline points={polyPts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
      <line x1={tx(xMin)} y1={ty(regY1)} x2={tx(xMax)} y2={ty(regY2)}
        stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
      {sorted.map((p) => (
        <circle key={p.N} cx={tx(p.N)} cy={ty(p[yKey])} r={3}
          fill="#7c3aed" stroke="white" strokeWidth="1">
          <title>N={p.N}: {yKey}={p[yKey]}</title>
        </circle>
      ))}
      <line x1={SVG_W - 130} y1={18} x2={SVG_W - 112} y2={18} stroke="#7c3aed" strokeWidth="2" />
      <text x={SVG_W - 108} y={21} fontSize="9" fill="#555">median</text>
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
  const [local, setLocal] = useState<LocalSweepData | null>(null);
  const [f1, setF1] = useState<F1Metrics | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [fErr, setFErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminComplexityData()
      .then(setComplexity)
      .catch(e => { if (!isAuthError(e)) setCErr(e.message); });
    fetchAdminComplexityLocal()
      .then(setLocal)
      .catch(() => { /* optional panel — silent on miss */ });
    fetchAdminF1Metrics()
      .then(setF1)
      .catch(e => { if (!isAuthError(e)) setFErr(e.message); });
  }, []);

  return (
    <div className="admin-complexity-tab">

      {local && (
        <>
          <section className="admin-section">
            <h2>Time complexity — algorithm only (controlled local sweep)</h2>
            <p className="empty-state-muted">
              Direct invocation of the C++ analyzer binary, timed in isolation
              (no HTTP, no queue, no concurrency). This is the pure algorithm
              cost vs input size — what the O(n) <em>time</em> claim is about.
              The production-cohort fits below are dominated by request-queue
              and process-spawn noise that the algorithm itself does not pay.
            </p>
            <LocalSweepChart points={local.pointsMedian} yKey="wall_ms"
              yLabel="wall_ms (median per N)"
              regression={local.regressionWallMsNormal}
              ariaLabel="Algorithm wall-time vs input lines (local sweep)" />
            <table className="complexity-coef-table">
              <thead><tr><th>Range</th><th>Slope</th><th>Intercept</th><th>R²</th><th>n</th><th>Interpretation</th></tr></thead>
              <tbody>
                <tr>
                  <td>Normal case (2000 ≤ N ≤ 14000)</td>
                  <td><code>{local.regressionWallMsNormal.slope} ms/line</code></td>
                  <td><code>{local.regressionWallMsNormal.intercept} ms</code></td>
                  <td><code>{local.regressionWallMsNormal.r2}</code></td>
                  <td><code>{local.regressionWallMsNormal.n}</code></td>
                  <td>{local.regressionWallMsNormal.interpretation}</td>
                </tr>
                <tr>
                  <td>Full range</td>
                  <td><code>{local.regressionWallMsFull.slope} ms/line</code></td>
                  <td><code>{local.regressionWallMsFull.intercept} ms</code></td>
                  <td><code>{local.regressionWallMsFull.r2}</code></td>
                  <td><code>{local.regressionWallMsFull.n}</code></td>
                  <td>{local.regressionWallMsFull.interpretation}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="admin-section">
            <h2>Space complexity — algorithm only (controlled local sweep)</h2>
            <p className="empty-state-muted">
              Peak resident set size sampled every 5ms during the analyzer
              subprocess run. Same controlled methodology as above; the
              difference between the algorithm&apos;s peak memory and the
              serialized analysis_json size on the live deploy is the
              per-request constant overhead of the HTTP path.
            </p>
            <LocalSweepChart points={local.pointsMedian} yKey="peak_kb"
              yLabel="peak_kb (median per N)"
              regression={local.regressionPeakKbNormal}
              ariaLabel="Algorithm peak memory vs input lines (local sweep)" />
            <table className="complexity-coef-table">
              <thead><tr><th>Range</th><th>Slope</th><th>Intercept</th><th>R²</th><th>n</th><th>Interpretation</th></tr></thead>
              <tbody>
                <tr>
                  <td>Normal case (2000 ≤ N ≤ 14000)</td>
                  <td><code>{local.regressionPeakKbNormal.slope} KB/line</code></td>
                  <td><code>{local.regressionPeakKbNormal.intercept} KB</code></td>
                  <td><code>{local.regressionPeakKbNormal.r2}</code></td>
                  <td><code>{local.regressionPeakKbNormal.n}</code></td>
                  <td>{local.regressionPeakKbNormal.interpretation}</td>
                </tr>
                <tr>
                  <td>Full range</td>
                  <td><code>{local.regressionPeakKbFull.slope} KB/line</code></td>
                  <td><code>{local.regressionPeakKbFull.intercept} KB</code></td>
                  <td><code>{local.regressionPeakKbFull.r2}</code></td>
                  <td><code>{local.regressionPeakKbFull.n}</code></td>
                  <td>{local.regressionPeakKbFull.interpretation}</td>
                </tr>
              </tbody>
            </table>
            <p className="f1-note-footnote">{local.methodologyNote}</p>
          </section>
        </>
      )}

      {cErr && <section className="admin-section"><div className="empty-state admin-error" role="alert">{cErr}</div></section>}
      {!complexity && !cErr && !local && <div className="empty-state">Loading…</div>}

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
          <h2>Space complexity — Working-set items vs token count</h2>
          <p className="empty-state-muted">
            y-axis: sum of <code>items_processed</code> across stages, used here as a proxy for the
            analyzer&apos;s in-memory working set (each item ≈ one structural-rep node held in RAM
            during analysis). x-axis: token count of the submission. Validates the O(n) <em>space</em>
            claim — items scale linearly with input size at near-constant bytes per item.
          </p>
          <table className="complexity-coef-table">
            <tbody>
              <tr><td>Slope</td><td><code>{complexity.regressionSpaceByTokens.slope} items/token</code></td></tr>
              <tr><td>Intercept</td><td><code>{complexity.regressionSpaceByTokens.intercept} items</code></td></tr>
              <tr><td>R²</td><td><code>{complexity.regressionSpaceByTokens.r2}</code></td></tr>
              <tr><td>n</td><td><code>{complexity.regressionSpaceByTokens.n} runs</code></td></tr>
              <tr><td>Interpretation</td><td>{complexity.regressionSpaceByTokens.interpretation}</td></tr>
            </tbody>
          </table>
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
                  <td><strong>Overall</strong></td>
                  <td><F1Badge value={f1.overall.precision} /></td>
                  <td><F1Badge value={f1.overall.recall} /></td>
                  <td><F1Badge value={f1.overall.f1} /></td>
                  <td>{f1.overall.tp}</td>
                  <td>{f1.overall.fp}</td>
                  <td>{f1.overall.fn}</td>
                  <td>{f1.overall.tn}</td>
                </tr>
                {f1.perPattern.map(p => (
                  <tr key={p.pattern}>
                    <td>{p.pattern}</td>
                    <td><F1Badge value={p.precision} /></td>
                    <td><F1Badge value={p.recall} /></td>
                    <td><F1Badge value={p.f1} /></td>
                    <td>{p.tp}</td>
                    <td>{p.fp}</td>
                    <td>{p.fn}</td>
                    <td title="Per-pattern TN intentionally omitted — see DESIGN_DECISIONS D36">—</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="f1-integration-note">
              {f1.userAccuracyAvg !== null && <>User accuracy avg: <strong>{f1.userAccuracyAvg}/5</strong></>}
              {f1.likertF1Correlation !== null && <> · Likert↔F1 correlation: <strong>{f1.likertF1Correlation}</strong></>}
              {' '}<span className="f1-note-footnote">({f1.note})</span>
            </p>
          </>
        )}
        {!f1 && !fErr && <div className="empty-state">Loading…</div>}
      </section>

    </div>
  );
}
