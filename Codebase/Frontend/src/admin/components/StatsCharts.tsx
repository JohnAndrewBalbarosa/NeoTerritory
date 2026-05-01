import { useEffect, useState } from 'react';
import {
  fetchAdminOverview, fetchAdminRunsPerDay, fetchAdminPatternFreq,
  fetchAdminTestRunStats
} from '../../api/client';
import {
  AdminOverview, RunsPerDayPoint, PatternFreqPoint
} from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

const PALETTE = ['#2563eb', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#ef4444', '#f59e0b'];

// Per-family colour map. The leading segment of patternId (`creational.X`,
// `structural.X`, …) buckets the slice; we use a deliberate per-family
// palette so the family pie reads consistently even as new patterns join
// the catalog.
const FAMILY_COLOR: Record<string, string> = {
  creational:  '#2563eb',
  structural:  '#10b981',
  behavioural: '#8b5cf6',
  other:       '#94a3b8'
};

interface PieSlice { label: string; value: number; color: string }

function PieChart({ slices, title, ariaLabel }: { slices: PieSlice[]; title: string; ariaLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <div className="empty-state">{title}: no data.</div>;
  const cx = 70, cy = 70, r = 56;
  let acc = 0;
  // Single full-circle slice degenerates to one path with d="..."; we fall
  // back to a bare circle so the renderer still shows something useful.
  const isOnlySlice = slices.filter(s => s.value > 0).length === 1;
  return (
    <figure className="stats-pie">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-label={ariaLabel}>
        {isOnlySlice
          ? <circle cx={cx} cy={cy} r={r} fill={slices.find(s => s.value > 0)!.color} />
          : slices.map((s, i) => {
              if (s.value <= 0) return null;
              const startAng = (acc / total) * Math.PI * 2 - Math.PI / 2;
              acc += s.value;
              const endAng = (acc / total) * Math.PI * 2 - Math.PI / 2;
              const x1 = cx + r * Math.cos(startAng), y1 = cy + r * Math.sin(startAng);
              const x2 = cx + r * Math.cos(endAng),   y2 = cy + r * Math.sin(endAng);
              const large = s.value / total > 0.5 ? 1 : 0;
              const pct = ((s.value / total) * 100).toFixed(1);
              return (
                <path
                  key={i}
                  d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth="1"
                >
                  <title>{s.label}: {s.value} ({pct}%)</title>
                </path>
              );
            })}
      </svg>
      <figcaption>
        <strong>{title}</strong>
        <ul className="stats-pie-legend">
          {slices.filter(s => s.value > 0).map((s, i) => (
            <li key={i}>
              <span className="stats-pie-swatch" style={{ background: s.color }} />
              <span className="stats-pie-label">{s.label}</span>
              <span className="stats-pie-value">{s.value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

interface SectionState<T> { data: T | null; error: string | null; }

function useStat<T>(loader: () => Promise<T>): SectionState<T> {
  const [state, setState] = useState<SectionState<T>>({ data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    loader()
      .then(d => { if (!cancelled) setState({ data: d, error: null }); })
      .catch(err => {
        if (cancelled) return;
        if (isAuthError(err)) { setState({ data: null, error: null }); return; }
        setState({ data: null, error: err instanceof Error ? err.message : 'Failed to load' });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <strong className="stat-tile-value">{value}</strong>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return <div className="empty-state admin-error" role="alert">Error: {message}</div>;
}

interface BarRowProps { label: string; value: number; max: number; color: string; }
export function BarRow({ label, value, max, color }: BarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="stat-bar-row" title={`${label}: ${value}`}>
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track" role="img" aria-label={`${label}: ${value} of ${max}`}>
        <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stat-bar-value">{value}</span>
    </div>
  );
}

// ── Runs-per-day SVG line chart ───────────────────────────────────────────────

const W = 600;
const H = 110;
const PAD = { top: 10, right: 16, bottom: 28, left: 32 };

function RunsLineChart({ series }: { series: RunsPerDayPoint[] }) {
  if (!series.length) return <div className="empty-state">No activity.</div>;

  const maxCount = Math.max(1, ...series.map(p => p.count));
  const xStep = (W - PAD.left - PAD.right) / Math.max(1, series.length - 1);
  const yScale = (H - PAD.top - PAD.bottom) / maxCount;

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => H - PAD.bottom - v * yScale;

  const pts = series.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' ');

  // Label every Nth point so they don't overlap.
  const labelEvery = Math.ceil(series.length / 8);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="runs-line-chart"
      aria-label="Runs per day line chart"
    >
      {/* Horizontal gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = toY(t * maxCount);
        const label = Math.round(t * maxCount);
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{label}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <polygon
        points={`${toX(0)},${toY(0)} ${pts} ${toX(series.length - 1)},${toY(0)}`}
        fill="rgba(37,99,235,0.08)"
      />

      {/* Line */}
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round" />

      {/* Dots */}
      {series.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.count)} r={p.count > 0 ? 3 : 2}
          fill={p.count > 0 ? '#2563eb' : '#cbd5e1'} />
      ))}

      {/* X axis labels */}
      {series.map((p, i) => i % labelEvery === 0 && (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {p.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

// ── Test-run accuracy ────────────────────────────────────────────────────────
//
// Aggregated from the gdb.<phase>.pass / gdb.<phase>.fail event log. The
// "accuracy" pill is just pass / (pass + fail) — a quick read of whether
// the unit-test suite is broadly healthy across all submissions.

interface TestRunStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  perPhase: Array<{ phase: string; passed: number; failed: number }>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatsCharts() {
  const overview    = useStat<AdminOverview>(fetchAdminOverview);
  const runsPerDay  = useStat<{ series: RunsPerDayPoint[] }>(() => fetchAdminRunsPerDay(7));
  const patternFreq = useStat<{ series: PatternFreqPoint[] }>(fetchAdminPatternFreq);
  const testRuns    = useStat<TestRunStats>(fetchAdminTestRunStats);

  const patternMax = Math.max(1, ...(patternFreq.data?.series || []).map(p => p.count));

  return (
    <div className="stats-charts">
      <section className="stats-overview">
        {overview.error && <ErrorRow message={overview.error} />}
        {overview.data && (
          <>
            <StatTile label="Users"        value={overview.data.totalUsers} />
            <StatTile label="Runs"         value={overview.data.totalRuns} />
            <StatTile label="Today"        value={overview.data.runsToday} />
            <StatTile label="Reviews"      value={overview.data.totalReviews} />
            <StatTile label="Avg findings" value={overview.data.avgFindings.toFixed(2)} />
          </>
        )}
      </section>

      <section className="stats-section">
        <h3>Runs per day (last 7, moving window)</h3>
        {runsPerDay.error && <ErrorRow message={runsPerDay.error} />}
        {runsPerDay.data && <RunsLineChart series={runsPerDay.data.series} />}
      </section>

      <section className="stats-section">
        <h3>Pattern frequency distribution</h3>
        {patternFreq.error && <ErrorRow message={patternFreq.error} />}
        {patternFreq.data && (patternFreq.data.series.length === 0
          ? <div className="empty-state">No patterns yet.</div>
          : (() => {
              const sorted = [...patternFreq.data.series].sort((a, b) => b.count - a.count);
              const top    = sorted.slice(0, 12);
              // Per-pattern slices use the same palette index as the bars
              // above so the legend ↔ bar colour mapping is consistent.
              const perPatternSlices: PieSlice[] = top.map((p, i) => ({
                label: p.pattern,
                value: p.count,
                color: PALETTE[i % PALETTE.length]
              }));
              const otherCount = sorted.slice(12).reduce((s, p) => s + p.count, 0);
              if (otherCount > 0) {
                perPatternSlices.push({ label: 'Other', value: otherCount, color: '#94a3b8' });
              }
              // Family bucketing: patternId is `<family>.<name>`.
              const byFamily = new Map<string, number>();
              for (const p of sorted) {
                const fam = (p.pattern.split('.')[0] || 'other').toLowerCase();
                byFamily.set(fam, (byFamily.get(fam) || 0) + p.count);
              }
              const familySlices: PieSlice[] = [...byFamily.entries()].map(([fam, value]) => ({
                label: fam.charAt(0).toUpperCase() + fam.slice(1),
                value,
                color: FAMILY_COLOR[fam] || FAMILY_COLOR.other
              }));
              return (
                <>
                  {top.map((p, i) => (
                    <BarRow key={p.pattern} label={p.pattern} value={p.count} max={patternMax} color={PALETTE[i % PALETTE.length]} />
                  ))}
                  <div className="stats-pies-row">
                    <PieChart slices={perPatternSlices} title="By pattern"  ariaLabel="Per-pattern frequency pie chart" />
                    <PieChart slices={familySlices}     title="By family"   ariaLabel="Per-family frequency pie chart" />
                  </div>
                </>
              );
            })())}
      </section>

      <section className="stats-section">
        <h3>Unit-test accuracy</h3>
        {testRuns.error && <ErrorRow message={testRuns.error} />}
        {testRuns.data && (testRuns.data.total === 0
          ? <div className="empty-state">No GDB test runs recorded yet.</div>
          : (
            <div className="test-run-stats">
              <div className="stats-overview">
                <StatTile label="Total cases"  value={testRuns.data.total} />
                <StatTile label="Passed"        value={testRuns.data.passed} />
                <StatTile label="Failed"        value={testRuns.data.failed} />
                <StatTile label="Pass rate"     value={`${(testRuns.data.passRate * 100).toFixed(1)}%`} />
              </div>
              {testRuns.data.perPhase.map(p => {
                const total = p.passed + p.failed;
                const rate = total > 0 ? p.passed / total : 0;
                return (
                  <BarRow
                    key={p.phase}
                    label={`${p.phase} (${p.passed}/${total})`}
                    value={Math.round(rate * 100)}
                    max={100}
                    color={rate >= 0.8 ? '#10b981' : rate >= 0.5 ? '#f59e0b' : '#ef4444'}
                  />
                );
              })}
            </div>
          ))}
      </section>

    </div>
  );
}
