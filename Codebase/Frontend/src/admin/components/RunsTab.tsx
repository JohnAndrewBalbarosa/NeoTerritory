import { useEffect, useState } from 'react';
import StatsCharts from './StatsCharts';
import { fetchAdminTestSummary, fetchAdminRuns } from '../../api/client';
import type { TestSummary } from '../../types/api';

// Run-stats tab. Top-of-tab metrics card surfaces:
//   - Total number of runs (live count from /api/admin/runs)
//   - Compile / static / unit pass rates from /api/admin/stats/test-summary
// followed by the existing StatsCharts visualisation. The test-summary card
// used to live on the Complexity tab; moved here so the panel can read the
// run-detail context (count + test pass rates) in one place.
export default function RunsTab() {
  const [tests, setTests] = useState<TestSummary | null>(null);
  const [runCount, setRunCount] = useState<number | null>(null);

  useEffect(() => {
    fetchAdminTestSummary()
      .then(setTests)
      .catch(() => { /* silent — charts still useful without the summary */ });

    fetchAdminRuns(500)
      .then((res) => {
        if (Array.isArray(res?.runs)) setRunCount(res.runs.length);
      })
      .catch(() => { /* keep silent — count is informational */ });
  }, []);

  return (
    <div className="admin-runs-tab">
      <section className="admin-section" data-testid="runs-metrics-card">
        <h2>Run-level metrics</h2>
        <p className="empty-state-muted">
          Number of analysis runs in the corpus plus the compile / static / unit
          test pass rates aggregated across every run. Use the charts below to
          drill into individual runs.
        </p>

        <div className="admin-runs-metrics-grid">
          <div className="admin-runs-metric">
            <span className="admin-runs-metric__label">Total runs</span>
            <span className="admin-runs-metric__value">
              {runCount !== null ? runCount : '—'}
            </span>
          </div>
          {tests && (
            <>
              <div className="admin-runs-metric">
                <span className="admin-runs-metric__label">Compile pass</span>
                <span className="admin-runs-metric__value">{tests.compile.passRate}%</span>
                <span className="admin-runs-metric__sub">
                  {tests.compile.passed}/{tests.compile.total} runs
                </span>
              </div>
              <div className="admin-runs-metric">
                <span className="admin-runs-metric__label">Static pass</span>
                <span className="admin-runs-metric__value">{tests.staticAnalysis.passRate}%</span>
                <span className="admin-runs-metric__sub">
                  {tests.staticAnalysis.passed}/{tests.staticAnalysis.total} runs · avg {tests.staticAnalysis.avgFindings} findings
                </span>
              </div>
              <div className="admin-runs-metric">
                <span className="admin-runs-metric__label">Unit-test pass</span>
                <span className="admin-runs-metric__value">{tests.unitTests.passRate}%</span>
                <span className="admin-runs-metric__sub">
                  {tests.unitTests.passedCases}/{tests.unitTests.totalCases} cases · {tests.unitTests.totalClasses} classes
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="admin-section">
        <h2>Run statistics</h2>
        <StatsCharts />
      </section>
    </div>
  );
}
