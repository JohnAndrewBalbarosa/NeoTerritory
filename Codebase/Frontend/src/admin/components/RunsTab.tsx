import StatsCharts from './StatsCharts';
import SurveyStats from './SurveyStats';

export default function RunsTab() {
  return (
    <div className="admin-runs-tab">
      <section className="admin-section">
        <h2>Run statistics</h2>
        <StatsCharts />
      </section>
      <section className="admin-section">
        <h2>Survey responses</h2>
        <SurveyStats />
      </section>
    </div>
  );
}
