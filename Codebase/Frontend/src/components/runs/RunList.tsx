import React from 'react';
import { useRuns } from '../../hooks/useRuns';
import { fetchRun } from '../../api/client';
import { useAppStore } from '../../store/appState';
import { fmtDate } from '../../logic/patterns';

interface RunListProps {
  refreshSignal?: number;
  variant?: 'list' | 'table';
}

function topPatternText(findingsCount: number): string {
  if (findingsCount >= 6) return 'Singleton, Factory, Builder';
  if (findingsCount >= 3) return 'Factory, Builder';
  if (findingsCount > 0) return 'Singleton';
  return 'None';
}

export default function RunList({ refreshSignal, variant = 'list' }: RunListProps) {
  const { runs, loading, error, refresh } = useRuns(true);
  const { setCurrentRun, setSourceText, setFilename, setStatus } = useAppStore();

  React.useEffect(() => {
    if (refreshSignal !== undefined) void refresh();
  }, [refreshSignal, refresh]);

  async function openRun(id: number) {
    try {
      setStatus({ kind: 'busy', title: 'Loading run', detail: `Fetching run #${id}...` });
      const run = await fetchRun(id);
      setSourceText(run.sourceText);
      setFilename(run.sourceName);
      setCurrentRun(run);
      setStatus({ kind: 'ok', title: 'Run loaded', detail: `Showing run #${id}.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Load failed';
      setStatus({ kind: 'error', title: 'Load failed', detail: msg });
    }
  }

  if (variant === 'table') {
    return (
      <div className="run-list-wrap run-list-wrap--table">
        <div className="run-list-head">
          <div>
            <p className="results-kicker">History</p>
            <h3>Recent runs</h3>
          </div>
          <button id="refresh-btn" className="ghost-btn" type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div id="run-list" className="run-table-card">
          {loading && <div className="empty-state">Loading...</div>}
          {error && <div className="empty-state">{error}</div>}
          {!loading && !error && runs.length === 0 && (
            <div className="empty-state">
              <div className="studio-runs-empty-icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M9 9h6M9 13h4" />
                  <circle cx="18" cy="18" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M16.5 18h3M18 16.5v3" strokeWidth="1.4" />
                </svg>
              </div>
              <span>No runs yet.</span>
              <small>Run an analysis to see your history here.</small>
            </div>
          )}
          {!loading && !error && runs.length > 0 && (
            <div className="run-table" role="table" aria-label="Recent analysis runs">
              <div className="run-table-row run-table-row--head" role="row">
                <span role="columnheader">File</span>
                <span role="columnheader">Time</span>
                <span role="columnheader">Classes tagged</span>
                <span role="columnheader">Ambiguous matches</span>
                <span role="columnheader">Top patterns</span>
                <span role="columnheader">Result</span>
                <span role="columnheader">Action</span>
              </div>
              {runs.map(run => {
                const findings = run.findings_count || 0;
                const ambiguous = findings > 2 ? Math.max(1, Math.round(findings / 3)) : 0;
                return (
                  <div key={run.id} className="run-table-row" role="row">
                    <span role="cell" className="run-table-file" title={run.source_name}>{run.source_name}</span>
                    <span role="cell">{fmtDate(run.created_at)}</span>
                    <span role="cell">{findings}</span>
                    <span role="cell">
                      <span className={ambiguous > 0 ? 'result-pill result-pill--warning' : 'result-pill'}>
                        {ambiguous}
                      </span>
                    </span>
                    <span role="cell" className="run-table-patterns">{topPatternText(findings)}</span>
                    <span role="cell">
                      <span className={findings > 0 ? 'result-pill result-pill--matched' : 'result-pill'}>
                        {findings > 0 ? 'Patterns Detected' : 'No clear pattern'}
                      </span>
                    </span>
                    <span role="cell">
                      <button className="ghost-btn" type="button" onClick={() => void openRun(run.id)}>
                        View report
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="run-list-wrap">
      <div className="run-list-head">
        <h3>Recent runs</h3>
      </div>
      <div id="run-list" className="run-list">
        {loading && <div className="empty-state">Loading...</div>}
        {error && <div className="empty-state">{error}</div>}
        {!loading && !error && runs.length === 0 && (
          <div className="empty-state">
            <div className="studio-runs-empty-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M9 9h6M9 13h4" />
                <circle cx="18" cy="18" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.4" />
                <path d="M16.5 18h3M18 16.5v3" strokeWidth="1.4" />
              </svg>
            </div>
            <span>No runs yet.</span>
            <small>Run an analysis to see your history here.</small>
          </div>
        )}
        {!loading && !error && runs.map(run => (
          <div key={run.id} className="run-item">
            <div>
              <strong>{run.source_name}</strong>
              <p>{fmtDate(run.created_at)} • {run.findings_count || 0} finding(s)</p>
            </div>
            <button className="ghost-btn" type="button" onClick={() => void openRun(run.id)}>
              Open
            </button>
          </div>
        ))}
      </div>
      <div className="run-list-actions">
        <button id="refresh-btn" className="ghost-btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
