import StatsCharts from './StatsCharts';

// Survey responses moved to the Reviews tab — this tab is run-stats only.
export default function RunsTab() {
  return (
    <div className="admin-runs-tab">
      <section className="admin-section">
        <h2>Run statistics</h2>
        <StatsCharts />
      </section>
    </div>
  );
}
