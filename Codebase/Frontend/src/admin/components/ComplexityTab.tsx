import { useEffect, useState } from 'react';
import { fetchAdminComplexityData, fetchAdminF1Metrics } from '../../api/client';
import { ComplexityData, F1Metrics, ComplexityPoint } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

// ─── Line chart (token-sorted, with regression overlay) ─────────────────────

const SVG_W = 480, SVG_H = 240, PAD = 48;

function ComplexityLineChart({ data }: { data: ComplexityData }) {
  const { points, regression } = data;
  if (points.length === 0) return <div className="empty-state">No complexity data yet.</div>;

  // Sort ascending by token count so the line chart makes directional sense.
  const sorted = [...points].sort((a, b) => a.loc - b.loc);

  const xMin = 0;
  const xMax = Math.max(...sorted.map(p => p.tokens), 1);
  const yMin = 0;
  const yMax = Math.max(...sorted.map(p => p.totalMs), 1);

  function tx(v: number) { return PAD + ((v - xMin) / (xMax - xMin)) * (SVG_W - PAD * 2); }
  function ty(v: number) { return SVG_H - PAD - ((v - yMin) / (yMax - yMin)) * (SVG_H - PAD * 2); }

  const polyPts = sorted.map(p => `${tx(p.tokens)},${ty(p.totalMs)}`).join(' ');

  // Regression line endpoints.
  const regY1 = Math.max(yMin, Math.min(yMax, regression.slope * xMin + regression.intercept));
  const regY2 = Math.max(yMin, Math.min(yMax, regression.slope * xMax + regression.intercept));

  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="complexity-scatter" aria-label="Tokens vs processing time line chart">
      {/* Grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round(xMin + (i / ticks) * (xMax - xMin));
        const x = tx(v);
        return (
          <g key={`xg${i}`}>
            <line x1={x} y1={PAD / 2} x2={x} y2={SVG_H - PAD} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={x} y1={SVG_H - PAD} x2={x} y2={SVG_H - PAD + 4} stroke="#aaa" strokeWidth="1" />
            <text x={x} y={SVG_H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round(yMin + (i / ticks) * (yMax - yMin));
        const y = ty(v);
        return (
          <g key={`yg${i}`}>
            <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="#aaa" strokeWidth="1" />
            <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />
      <line x1={PAD} y1={SVG_H - PAD} x2={SVG_W - PAD / 2} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />

      {/* Axis labels */}
      <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fontSize="10" fill="#666">Tokens</text>
      <text x={12} y={SVG_H / 2} textAnchor="middle" fontSize="10" fill="#666"
        transform={`rotate(-90 12 ${SVG_H / 2})`}>ms</text>

      {/* Area fill under actual data */}
      <polygon
        points={`${tx(sorted[0]!.loc)},${ty(0)} ${polyPts} ${tx(sorted[sorted.length - 1]!.loc)},${ty(0)}`}
        fill="rgba(47,90,174,0.07)"
      />

      {/* Actual data line */}
      <polyline points={polyPts} fill="none" stroke="#2f5aae" strokeWidth="2" strokeLinejoin="round" />

      {/* Regression overlay (dashed) */}
      <line
        x1={tx(xMin)} y1={ty(regY1)}
        x2={tx(xMax)} y2={ty(regY2)}
        stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8"
      />

      {/* Data point dots */}
      {sorted.map((p: ComplexityPoint) => (
        <circle key={p.runId} cx={tx(p.tokens)} cy={ty(p.totalMs)} r={3}
          fill="#2f5aae" stroke="white" strokeWidth="1">
          <title>Run {p.runId}: {p.tokens} tokens, {p.totalMs}ms, {p.patternCount} patterns</title>
        </circle>
      ))}

      {/* Legend */}
      <line x1={SVG_W - 130} y1={18} x2={SVG_W - 112} y2={18} stroke="#2f5aae" strokeWidth="2" />
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
  const [f1, setF1] = useState<F1Metrics | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [fErr, setFErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminComplexityData()
      .then(setComplexity)
      .catch(e => { if (!isAuthError(e)) setCErr(e.message); });
    fetchAdminF1Metrics()
      .then(setF1)
      .catch(e => { if (!isAuthError(e)) setFErr(e.message); });
  }, []);

  return (
    <div className="admin-complexity-tab">

      <section className="admin-section">
        <h2>Processing time vs token count</h2>
        {cErr && <div className="empty-state admin-error" role="alert">{cErr}</div>}
        {complexity && (
          <>
            <ComplexityLineChart data={complexity} />
            <table className="complexity-coef-table">
              <tbody>
                <tr><td>Slope</td><td><code>{complexity.regression.slope} ms/token</code></td></tr>
                <tr><td>Intercept</td><td><code>{complexity.regression.intercept} ms</code></td></tr>
                <tr><td>R²</td><td><code>{complexity.regression.r2}</code></td></tr>
                <tr><td>n</td><td><code>{complexity.regression.n} runs</code></td></tr>
                <tr><td>Interpretation</td><td>{complexity.regression.interpretation}</td></tr>
              </tbody>
            </table>
          </>
        )}
        {!complexity && !cErr && <div className="empty-state">Loading…</div>}
      </section>

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
