import { useEffect, useState } from 'react';
import { fetchAdminSurveySummary } from '../../api/client';
import { SurveySummary, LikertMetric } from '../../types/api';

function MiniDistribution({ dist }: { dist: number[] }) {
  const max = Math.max(1, ...dist);
  return (
    <div className="likert-mini-dist" aria-hidden="true">
      {dist.map((count, i) => (
        <div key={i} className="likert-mini-bar-wrap" title={`Rating ${i + 1}: ${count}`}>
          <div
            className="likert-mini-bar"
            style={{ height: `${Math.round((count / max) * 32)}px` }}
          />
          <span className="likert-mini-label">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function MetricBar({ label, metric }: { label: string; metric: LikertMetric }) {
  const pct = (metric.avg / 5) * 100;
  return (
    <div className="survey-metric">
      <div className="survey-metric-header">
        <span className="survey-metric-label">{label}</span>
        <span className="survey-metric-avg">{metric.avg.toFixed(2)}<span className="survey-metric-denom">/5</span></span>
        <span className="survey-metric-count">n={metric.count}</span>
      </div>
      <div className="survey-metric-track">
        <div className="survey-metric-fill" style={{ width: `${pct}%` }} />
      </div>
      <MiniDistribution dist={metric.distribution} />
    </div>
  );
}

const QUESTION_LABELS: Record<string, string> = {
  accuracy:           'Accuracy',
  overall_usefulness: 'Overall usefulness',
  ui_clarity:         'UI clarity',
  confidence:         'Confidence',
  ease_of_use:        'Ease of use'
};

function labelFor(key: string) {
  return QUESTION_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function SurveyStats() {
  const [data, setData] = useState<SurveySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSurveySummary()
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">Survey error: {error}</div>;
  if (!data) return <div className="empty-state">Loading survey stats…</div>;

  const perRunKeys = Object.keys(data.perRun);
  const sessionKeys = Object.keys(data.endOfSession);

  return (
    <div className="survey-stats">
      {perRunKeys.length > 0 && (
        <section className="stats-section">
          <h3>Per-run ratings</h3>
          {perRunKeys.map(k => (
            <MetricBar key={k} label={labelFor(k)} metric={data.perRun[k]!} />
          ))}
        </section>
      )}
      {sessionKeys.length > 0 && (
        <section className="stats-section">
          <h3>End-of-session ratings</h3>
          {sessionKeys.map(k => (
            <MetricBar key={k} label={labelFor(k)} metric={data.endOfSession[k]!} />
          ))}
        </section>
      )}
      {perRunKeys.length === 0 && sessionKeys.length === 0 && (
        <div className="empty-state">No survey responses yet.</div>
      )}
    </div>
  );
}
