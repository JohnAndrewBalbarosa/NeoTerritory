import React from 'react';
import { useRuns } from '../../hooks/useRuns';
import { fetchRun } from '../../api/client';
import { useAppStore } from '../../store/appState';
import { fmtDate } from '../../lib/patterns';

interface RunListProps {
  refreshSignal?: number;
}

export default function RunList({ refreshSignal }: RunListProps) {
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

  return (
    <div className="run-list-wrap">
      <div className="run-list-head">
        <h3>Saved runs</h3>
        <button id="refresh-btn" className="ghost-btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      <div id="run-list" className="run-list">
        {loading && <div className="empty-state">Loading...</div>}
        {error && <div className="empty-state">{error}</div>}
        {!loading && !error && runs.length === 0 && (
          <div className="empty-state">No runs stored yet.</div>
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
    </div>
  );
}
