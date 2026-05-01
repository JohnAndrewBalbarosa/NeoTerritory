import StatsCharts from './StatsCharts';
import SurveyStats from './SurveyStats';
import RunsManager from './RunsManager';

export default function RunsTab() {
  return (
    <div className="admin-runs-tab">
      <section className="admin-section">
        <h2>Run statistics</h2>
        <StatsCharts />
      </section>
      <section className="admin-section">
        <h2>Manage runs</h2>
        <p className="admin-section-lede">
          Delete individual analysis runs (e.g. test pollution) — every removal
          is recorded in the audit log on the Logs tab.
        </p>
        <RunsManager />
      </section>
      <section className="admin-section">
        <h2>Survey responses</h2>
        <SurveyStats />
      </section>
    </div>
  );
}
