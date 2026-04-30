import { useEffect, useState } from 'react';
import {
  fetchAdminOverview, fetchAdminRunsPerDay, fetchAdminPatternFreq,
  fetchAdminScoreDistribution, fetchAdminPerUser
} from '../../api/client';
import {
  AdminOverview, RunsPerDayPoint, PatternFreqPoint, ScoreBucket, PerUserPoint
} from '../../types/api';

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

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

const PALETTE = ['#2563eb', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#ef4444', '#f59e0b'];

interface SectionState<T> {
  data: T | null;
  error: string | null;
}

function useStat<T>(loader: () => Promise<T>): SectionState<T> {
  const [state, setState] = useState<SectionState<T>>({ data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    loader()
      .then(d => { if (!cancelled) setState({ data: d, error: null }); })
      .catch(err => {
        if (!cancelled) {
          setState({ data: null, error: err instanceof Error ? err.message : 'Failed to load' });
        }
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

export default function StatsCharts() {
  const overview = useStat<AdminOverview>(fetchAdminOverview);
  const runsPerDay = useStat<{ series: RunsPerDayPoint[] }>(() => fetchAdminRunsPerDay(30));
  const patternFreq = useStat<{ series: PatternFreqPoint[] }>(fetchAdminPatternFreq);
  const scoreDist = useStat<{ buckets: ScoreBucket[] }>(fetchAdminScoreDistribution);
  const perUser = useStat<{ series: PerUserPoint[] }>(fetchAdminPerUser);

  const dailyMax = Math.max(1, ...(runsPerDay.data?.series || []).map(p => p.count));
  const patternMax = Math.max(1, ...(patternFreq.data?.series || []).map(p => p.count));
  const userMax = Math.max(1, ...(perUser.data?.series || []).map(p => p.runs));

  return (
    <div className="stats-charts">
      <section className="stats-overview">
        {overview.error && <ErrorRow message={overview.error} />}
        {overview.data && (
          <>
            <StatTile label="Users" value={overview.data.totalUsers} />
            <StatTile label="Runs" value={overview.data.totalRuns} />
            <StatTile label="Today" value={overview.data.runsToday} />
            <StatTile label="Reviews" value={overview.data.totalReviews} />
            <StatTile label="Avg findings" value={overview.data.avgFindings.toFixed(2)} />
          </>
        )}
      </section>

      <section className="stats-section">
        <h3>Runs per day (last 30)</h3>
        {runsPerDay.error && <ErrorRow message={runsPerDay.error} />}
        {runsPerDay.data && (runsPerDay.data.series.length === 0
          ? <div className="empty-state">No activity.</div>
          : runsPerDay.data.series.map(p => (
              <BarRow key={p.date} label={p.date.slice(5)} value={p.count} max={dailyMax} color="#2563eb" />
            )))}
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
        {scoreDist.data && (scoreDist.data.buckets.length === 0
          ? <div className="empty-state">No scores.</div>
          : scoreDist.data.buckets.map((b, i) => (
              <BarRow key={b.range} label={b.range} value={b.count} max={Math.max(1, ...scoreDist.data!.buckets.map(x => x.count))} color={PALETTE[i % PALETTE.length]} />
            )))}
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
