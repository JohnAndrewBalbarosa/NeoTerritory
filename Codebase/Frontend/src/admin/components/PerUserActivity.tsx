import { useEffect, useState } from 'react';
import { fetchAdminPerUser } from '../../api/client';
import { PerUserPoint } from '../../types/api';
import { BarRow } from './StatsCharts';
import { isAuthError } from '../lib/silenceAuthErrors';

// Per-user activity belongs on the Users tab — it's a property of who's
// using the system, not of run statistics in the abstract.
export default function PerUserActivity() {
  const [series, setSeries] = useState<PerUserPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminPerUser()
      .then(d => setSeries(d.series || []))
      .catch(e => { if (isAuthError(e)) { setSeries([]); return; } setError(e instanceof Error ? e.message : 'Failed'); });
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">{error}</div>;
  if (series === null) return <div className="empty-state">Loading…</div>;
  if (series.length === 0) return <div className="empty-state">No activity yet.</div>;

  const max = Math.max(1, ...series.map(p => p.runs));
  return (
    <div className="per-user-activity">
      {series.map(p => (
        <BarRow key={p.username} label={p.username} value={p.runs} max={max} color="var(--accent)" />
      ))}
    </div>
  );
}
