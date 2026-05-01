import { useEffect, useState } from 'react';
import {
  fetchAdminOverview, fetchAdminRunsPerDay, fetchAdminPatternFreq,
  fetchAdminScoreDistribution, fetchAdminPerUser
} from '../../api/client';
import {
  AdminOverview, RunsPerDayPoint, PatternFreqPoint, ScoreBucket, PerUserPoint
} from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

const PALETTE = ['#2563eb', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#ef4444', '#f59e0b'];

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
function BarRow({ label, value, max, color }: BarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track">
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

// ── Score distribution grouped table ─────────────────────────────────────────

function ScoreDistTable({ buckets }: { buckets: ScoreBucket[] }) {
  if (!buckets.length) return <div className="empty-state">No scores.</div>;
  const maxCount = Math.max(1, ...buckets.map(b => b.count));
  return (
    <table className="score-dist-table">
      <thead>
        <tr>
          <th>Patterns found</th>
          <th>Runs</th>
          <th className="score-dist-bar-col">Distribution</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b, i) => {
          const pct = Math.round((b.count / maxCount) * 100);
          return (
            <tr key={b.range}>
              <td>{b.range}</td>
              <td><strong>{b.count}</strong></td>
              <td className="score-dist-bar-col">
                <div className="score-dist-bar-track">
                  <div className="score-dist-bar-fill" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatsCharts() {
  const overview    = useStat<AdminOverview>(fetchAdminOverview);
  const runsPerDay  = useStat<{ series: RunsPerDayPoint[] }>(() => fetchAdminRunsPerDay(30));
  const patternFreq = useStat<{ series: PatternFreqPoint[] }>(fetchAdminPatternFreq);
  const scoreDist   = useStat<{ buckets: ScoreBucket[] }>(fetchAdminScoreDistribution);
  const perUser     = useStat<{ series: PerUserPoint[] }>(fetchAdminPerUser);

  const patternMax = Math.max(1, ...(patternFreq.data?.series || []).map(p => p.count));
  const userMax    = Math.max(1, ...(perUser.data?.series    || []).map(p => p.runs));

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
        <h3>Runs per day (last 30)</h3>
        {runsPerDay.error && <ErrorRow message={runsPerDay.error} />}
        {runsPerDay.data && <RunsLineChart series={runsPerDay.data.series} />}
      </section>

      <section className="stats-section">
        <h3>Pattern frequency</h3>
        {patternFreq.error && <ErrorRow message={patternFreq.error} />}
        {patternFreq.data && (patternFreq.data.series.length === 0
          ? <div className="empty-state">No patterns yet.</div>
          : patternFreq.data.series.slice(0, 12).map((p, i) => (
              <BarRow key={p.pattern} label={p.pattern} value={p.count} max={patternMax} color={PALETTE[i % PALETTE.length]} />
            )))}
      </section>

      <section className="stats-section">
        <h3>Score distribution</h3>
        {scoreDist.error && <ErrorRow message={scoreDist.error} />}
        {scoreDist.data && <ScoreDistTable buckets={scoreDist.data.buckets} />}
      </section>

      <section className="stats-section">
        <h3>Per-user activity</h3>
        {perUser.error && <ErrorRow message={perUser.error} />}
        {perUser.data && (perUser.data.series.length === 0
          ? <div className="empty-state">No activity.</div>
          : perUser.data.series.map(p => (
              <BarRow key={p.username} label={p.username} value={p.runs} max={userMax} color="#2563eb" />
            )))}
      </section>
    </div>
  );
}
