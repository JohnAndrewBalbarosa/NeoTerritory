import AnalysisForm from '../analysis/AnalysisForm';
import RunList from '../runs/RunList';
import { AnalysisRun } from '../../types/api';

interface SubmitTabProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  refreshSignal: number;
  beforeAnalyze?: (dispatch: () => void) => void;
}

export default function SubmitTab({ onAnalysisComplete, refreshSignal, beforeAnalyze }: SubmitTabProps) {
  // The linear-flow "Next: Run tests →" button was removed (this turn).
  // Navigation between Submit and Tests now goes through the tab bar, so
  // this tab is just the analysis form plus the run list.

  // Single-popup behavior: hand straight to MainLayout's beforeAnalyze, which
  // shows the discard-or-keep-editing prompt only when there is an existing
  // run to clobber. Per-run survey questions live in the Review tab now.
  function handleBeforeAnalyze(dispatch: () => void): void {
    if (beforeAnalyze) beforeAnalyze(dispatch);
    else dispatch();
  }

  return (
    <section className="tab-panel tab-submit">
      <AnalysisForm
        onAnalysisComplete={onAnalysisComplete}
        beforeSubmit={handleBeforeAnalyze}
      />
      <RunList refreshSignal={refreshSignal} />
    </section>
  );
}
