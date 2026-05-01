import { useEffect, useState } from 'react';
import { fetchAdminComplexityData, fetchAdminF1Metrics } from '../../api/client';
import { ComplexityData, F1Metrics, ComplexityPoint } from '../../types/api';

// ─── Scatter plot ─────────────────────────────────────────────────────────────

const SVG_W = 480, SVG_H = 280, PAD = 48;

function ScatterPlot({ data }: { data: ComplexityData }) {
  const { points, regression } = data;
  if (points.length === 0) return <div className="empty-state">No complexity data yet.</div>;

  const xMin = 0;
  const xMax = Math.max(...points.map(p => p.loc), 1);
  const yMin = 0;
  const yMax = Math.max(...points.map(p => p.totalMs), 1);

  function tx(v: number) { return PAD + ((v - xMin) / (xMax - xMin)) * (SVG_W - PAD * 2); }
  function ty(v: number) { return SVG_H - PAD - ((v - yMin) / (yMax - yMin)) * (SVG_H - PAD * 2); }

  const x1 = xMin, y1 = regression.slope * x1 + regression.intercept;
  const x2 = xMax, y2 = regression.slope * x2 + regression.intercept;

  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="complexity-scatter" aria-label="LOC vs processing time scatter">
      {/* Axes */}
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />
      <line x1={PAD} y1={SVG_H - PAD} x2={SVG_W - PAD / 2} y2={SVG_H - PAD} stroke="#ccc" strokeWidth="1" />

      {/* X ticks */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round(xMin + (i / ticks) * (xMax - xMin));
        const x = tx(v);
        return (
          <g key={i}>
            <line x1={x} y1={SVG_H - PAD} x2={x} y2={SVG_H - PAD + 4} stroke="#aaa" strokeWidth="1" />
            <text x={x} y={SVG_H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}
      {/* Y ticks */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = Math.round(yMin + (i / ticks) * (yMax - yMin));
        const y = ty(v);
        return (
          <g key={i}>
            <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="#aaa" strokeWidth="1" />
            <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#888">{v}</text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fontSize="10" fill="#666">LOC</text>
      <text x={12} y={SVG_H / 2} textAnchor="middle" fontSize="10" fill="#666"
        transform={`rotate(-90 12 ${SVG_H / 2})`}>ms</text>

      {/* Regression line */}
      <line
        x1={tx(x1)} y1={ty(Math.max(yMin, Math.min(yMax, y1)))}
        x2={tx(x2)} y2={ty(Math.max(yMin, Math.min(yMax, y2)))}
        stroke="#2f5aae" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7"
      />

      {/* Points */}
      {points.map((p: ComplexityPoint) => (
        <circle key={p.runId} cx={tx(p.loc)} cy={ty(p.totalMs)} r={3.5}
          fill="#2f5aae" fillOpacity="0.55" stroke="#2f5aae" strokeWidth="0.5">
          <title>Run {p.runId}: {p.loc} LOC, {p.totalMs}ms, {p.patternCount} patterns</title>
        </circle>
      ))}
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
    fetchAdminComplexityData().then(setComplexity).catch(e => setCErr(e.message));
    fetchAdminF1Metrics().then(setF1).catch(e => setFErr(e.message));
  }, []);

  return (
    <div className="admin-complexity-tab">

      <section className="admin-section">
        <h2>Processing time vs LOC</h2>
        {cErr && <div className="empty-state admin-error" role="alert">{cErr}</div>}
        {complexity && (
          <>
            <ScatterPlot data={complexity} />
            <table className="complexity-coef-table">
              <tbody>
                <tr><td>Slope</td><td><code>{complexity.regression.slope} ms/LOC</code></td></tr>
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
            <div className="f1-overall-cards">
              <div className="stat-tile">
                <span className="stat-tile-label">Precision</span>
                <strong className="stat-tile-value"><F1Badge value={f1.overall.precision} /></strong>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-label">Recall</span>
                <strong className="stat-tile-value"><F1Badge value={f1.overall.recall} /></strong>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-label">F1</span>
                <strong className="stat-tile-value"><F1Badge value={f1.overall.f1} /></strong>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-label">TP / FP / FN</span>
                <strong className="stat-tile-value">{f1.overall.tp} / {f1.overall.fp} / {f1.overall.fn}</strong>
              </div>
            </div>

            {f1.perPattern.length > 0 && (
              <table className="f1-pattern-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>TP</th><th>FP</th><th>FN</th>
                  </tr>
                </thead>
                <tbody>
                  {f1.perPattern.map(p => (
                    <tr key={p.pattern}>
                      <td>{p.pattern}</td>
                      <td><F1Badge value={p.precision} /></td>
                      <td><F1Badge value={p.recall} /></td>
                      <td><F1Badge value={p.f1} /></td>
                      <td>{p.tp}</td><td>{p.fp}</td><td>{p.fn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

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
