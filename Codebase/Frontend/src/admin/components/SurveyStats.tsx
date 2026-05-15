import { useEffect, useState } from 'react';
import {
  fetchAdminSurveySummary,
  fetchAdminPerRunFeedback,
  fetchAdminPerSessionFeedback
} from '../../api/client';
import {
  SurveySummary, LikertMetric,
  AdminPerRunFeedbackRow, AdminPerSessionFeedbackRow
} from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

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

// 2026-05-15 instrument. Section A (profile, A.1–A.5) is a respondent
// profile and is shown by raw id; Sections B–F are the Likert items
// labelled here so the admin panel reads the full prompt instead of
// the bare question id.
const QUESTION_LABELS: Record<string, string> = {
  // Section A — respondent profile (categorical, not Likert)
  'A.1': 'A.1 Current year level',
  'A.2': 'A.2 Programming experience',
  'A.3': 'A.3 Familiarity with C++',
  'A.4': 'A.4 Familiarity with object-oriented programming',
  'A.5': 'A.5 Familiarity with design patterns',
  // Section B — Functional Suitability
  'B.1': 'B.1 Learning modules help me understand design-pattern concepts.',
  'B.2': 'B.2 Examples in modules show how patterns appear in code.',
  'B.3': 'B.3 System helps me understand unfamiliar C++ source code.',
  'B.4': 'B.4 System helps me identify important parts of the analyzed code.',
  'B.5': 'B.5 System helps me connect pattern concepts to actual C++ code.',
  'B.6': 'B.6 Generated documentation explains structure, purpose, and key parts.',
  'B.7': 'B.7 Generated unit-test targets help me recognize areas needing checking.',
  'B.8': 'B.8 Useful as a learning support tool for DEVCON interns / novices.',
  // Section C — Usability
  'C.9':  'C.9 Interface is easy to understand.',
  'C.10': 'C.10 Easy to access and navigate the learning modules.',
  'C.11': 'C.11 Easy to enter, paste, or submit C++ code.',
  'C.12': 'C.12 Analysis results are organized clearly.',
  'C.13': 'C.13 Detected pattern evidence and highlighted code structures are clear.',
  // Section D — Performance Efficiency
  'D.14': 'D.14 Loads, responds, and generates results in acceptable time.',
  'D.15': 'D.15 Responds quickly when moving between modules, results, docs, surveys.',
  // Section E — Reliability
  'E.16': 'E.16 Clear feedback when code cannot be analyzed properly.',
  'E.17': 'E.17 Stable results on similar inputs.',
  // Section F — Security & Data Protection
  'F.18': 'F.18 Handles submitted code and responses responsibly.',
  'F.19': 'F.19 Protects user responses from unauthorized disclosure.'
};

function labelFor(key: string) {
  return QUESTION_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function SurveyStats() {
  const [data, setData] = useState<SurveySummary | null>(null);
  const [perRunRows, setPerRunRows] = useState<AdminPerRunFeedbackRow[]>([]);
  const [perSessRows, setPerSessRows] = useState<AdminPerSessionFeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSurveySummary()
      .then(setData)
      .catch(err => {
        if (isAuthError(err)) { setData(null); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
      });
    fetchAdminPerRunFeedback()
      .then(d => setPerRunRows(d.rows || []))
      .catch(err => { if (!isAuthError(err)) setError(err.message); });
    fetchAdminPerSessionFeedback()
      .then(d => setPerSessRows(d.rows || []))
      .catch(err => { if (!isAuthError(err)) setError(err.message); });
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">Survey error: {error}</div>;
  if (!data) return <div className="empty-state">Loading survey stats…</div>;

  const perRunKeys = Object.keys(data.perRun);
  const sessionKeys = Object.keys(data.endOfSession);

  // Union of question ids actually present so the table headers reflect
  // the live data, not a hard-coded list. Sorted by section letter +
  // numeric suffix for stable order.
  function unionRatingKeys(rows: Array<{ ratings: Record<string, number> }>): string[] {
    const order = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seen = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r.ratings || {})) seen.add(k);
    return [...seen].sort((a, b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0]);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      const an = parseInt(a.replace(/\D+/g, ''), 10) || 0;
      const bn = parseInt(b.replace(/\D+/g, ''), 10) || 0;
      return an - bn;
    });
  }
  const perRunCols = unionRatingKeys(perRunRows);
  const perSessCols = unionRatingKeys(perSessRows);

  // Hit the backend's CSV export endpoint via a Bearer-authed fetch so
  // the file downloads with the admin's privileges. We can't use a raw
  // <a download> because that wouldn't carry the JWT.
  async function exportCsv() {
    try {
      const token = localStorage.getItem('nt_token') || '';
      const resp = await fetch('/api/admin/stats/survey-export.xlsx', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `neoterritory-questionnaire-b-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('CSV export failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="survey-stats">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          type="button"
          className="ghost-btn"
          onClick={exportCsv}
          title="Download every Questionnaire B response as a CSV file"
        >
          ⤓ Export Questionnaire B (XLSX, 3 sheets)
        </button>
      </div>

      {/* === Per-run review submissions ===================================== */}
      <section className="stats-section">
        <h3>Per-run review submissions</h3>
        {perRunRows.length === 0
          ? <div className="empty-state">No per-run feedback submitted yet.</div>
          : (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Run #</th>
                    <th>Source</th>
                    <th>Submitted</th>
                    {perRunCols.map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {perRunRows.map(r => (
                    <tr key={r.id}>
                      <td>{r.username || '—'}</td>
                      <td>{r.runId}</td>
                      <td><code>{r.runSourceName || '—'}</code></td>
                      <td className="logs-td-date">{r.submittedAt}</td>
                      {perRunCols.map(k => <td key={k}>{r.ratings[k] ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* === Per-sign-out review submissions ================================ */}
      <section className="stats-section">
        <h3>Per-sign-out review submissions</h3>
        {perSessRows.length === 0
          ? <div className="empty-state">No sign-out feedback submitted yet.</div>
          : (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Session</th>
                    <th>Submitted</th>
                    {perSessCols.map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {perSessRows.map(r => (
                    <tr key={r.id}>
                      <td>{r.username || '—'}</td>
                      <td><code>{r.sessionUuid}</code></td>
                      <td className="logs-td-date">{r.submittedAt}</td>
                      {perSessCols.map(k => <td key={k}>{r.ratings[k] ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

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
