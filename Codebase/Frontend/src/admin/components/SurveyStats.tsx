import { useEffect, useState } from 'react';
import {
  fetchAdminSurveySummary,
  fetchAdminPerRunFeedback,
  fetchAdminPerSessionFeedback,
  fetchAdminOpenEnded
} from '../../api/client';
import {
  SurveySummary, LikertMetric,
  AdminPerRunFeedbackRow, AdminPerSessionFeedbackRow, AdminOpenEndedRow
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

// Questionnaire B item bank — Section A (profile) is excluded since it
// isn't on the Likert scale. Sections B–F are the rating items the
// admin Survey panel should label by their full prompt rather than
// the bare question id.
const QUESTION_LABELS: Record<string, string> = {
  // Section B — Functional Suitability and Code Understanding Support
  B1:  'B1. Helps me understand unfamiliar C++ source code.',
  B2:  'B2. Helps me identify important parts of the analyzed code.',
  B3:  'B3. Generated documentation is clear and understandable.',
  B4:  'B4. Documentation explains the purpose of the analyzed code.',
  B5:  'B5. Detected design-pattern evidence connects concepts to code.',
  B6:  'B6. Explanations help me understand why structures relate to a pattern.',
  B7:  'B7. Generated unit-test targets identify what may need testing.',
  B8:  'B8. Unit-test targets help me understand expected behavior.',
  B9:  'B9. Useful during internship onboarding.',
  B10: 'B10. Overall useful for code understanding & pattern learning.',
  // Section C — Usability and Interface Clarity
  C11: 'C11. Interface is easy to understand.',
  C12: 'C12. Easy to enter or paste C++ code into the system.',
  C13: 'C13. I can understand what the system shows after analysis.',
  C14: 'C14. Displayed results are organized clearly.',
  C15: 'C15. Easy to use even with minimal assistance.',
  // Section D — Performance Efficiency
  D16: 'D16. Loads and responds within an acceptable time.',
  D17: 'D17. Generates analysis without noticeable delays.',
  D18: 'D18. Stays responsive while processing submitted code.',
  // Section E — Reliability
  E19: 'E19. Works consistently when analyzing valid C++ code.',
  E20: 'E20. Provides clear feedback when code cannot be analyzed.',
  E21: 'E21. Produces stable results on similar inputs.',
  // Section F — Security and Data Protection
  F22: 'F22. Handles submitted code and responses responsibly.',
  F23: 'F23. Assures information is used only for academic purpose.',
  F24: 'F24. Protects responses from unauthorized disclosure.'
};

function labelFor(key: string) {
  return QUESTION_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function SurveyStats() {
  const [data, setData] = useState<SurveySummary | null>(null);
  const [perRunRows, setPerRunRows] = useState<AdminPerRunFeedbackRow[]>([]);
  const [perSessRows, setPerSessRows] = useState<AdminPerSessionFeedbackRow[]>([]);
  const [openRows, setOpenRows] = useState<AdminOpenEndedRow[]>([]);
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
    fetchAdminOpenEnded()
      .then(d => setOpenRows(d.rows || []))
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
    const order = ['B', 'C', 'D', 'E', 'F', 'G'];
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

      {/* === Open-ended text answers ======================================== */}
      <section className="stats-section">
        <h3>Open-ended text answers</h3>
        {openRows.length === 0
          ? <div className="empty-state">No open-ended answers submitted yet.</div>
          : (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Source</th>
                    <th>Question</th>
                    <th>Answer (click to expand)</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {openRows.map((r, i) => (
                    <tr key={`${r.source}-${r.id}-${r.questionId}-${i}`}>
                      <td>{r.username || '—'}</td>
                      <td><code>{r.source}</code></td>
                      <td>{r.questionId}</td>
                      <td>
                        <details>
                          <summary>{r.text.slice(0, 80)}{r.text.length > 80 ? '…' : ''}</summary>
                          <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', padding: 8, background: 'var(--surface2)', borderRadius: 4, fontFamily: 'inherit', fontSize: 12.5 }}>{r.text}</pre>
                        </details>
                      </td>
                      <td className="logs-td-date">{r.submittedAt}</td>
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
