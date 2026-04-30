import { useState } from 'react';
import AnalysisForm from '../analysis/AnalysisForm';
import RunList from '../runs/RunList';
import RunSurveyModal from '../survey/RunSurveyModal';
import { useAppStore } from '../../store/appState';
import { AnalysisRun } from '../../types/api';

interface SubmitTabProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  refreshSignal: number;
}

export default function SubmitTab({ onAnalysisComplete, refreshSignal }: SubmitTabProps) {
  const { sessionRanAnalyze, pendingRunSurveyForRunKey, setPendingRunSurvey, currentRun } = useAppStore();
  const [queuedSubmit, setQueuedSubmit] = useState<null | (() => void)>(null);

  const surveyBlocking = sessionRanAnalyze && pendingRunSurveyForRunKey !== null;

  // Wrap the analyze trigger: if a previous run exists and the per-run survey
  // hasn't been submitted yet, show the survey first and queue the dispatch.
  function handleBeforeAnalyze(dispatch: () => void): void {
    if (sessionRanAnalyze && currentRun && pendingRunSurveyForRunKey === null) {
      const key = String(currentRun.runId ?? currentRun.pendingId ?? Date.now());
      setPendingRunSurvey(key);
      setQueuedSubmit(() => dispatch);
      return;
    }
    dispatch();
  }

  function onSurveyDone() {
    setPendingRunSurvey(null);
    if (queuedSubmit) {
      const fn = queuedSubmit;
      setQueuedSubmit(null);
      fn();
    }
  }

  return (
    <section className="tab-panel tab-submit">
      <AnalysisForm
        onAnalysisComplete={onAnalysisComplete}
        beforeSubmit={handleBeforeAnalyze}
      />
      <RunList refreshSignal={refreshSignal} />
      {surveyBlocking && pendingRunSurveyForRunKey && (
        <RunSurveyModal
          runKey={pendingRunSurveyForRunKey}
          onSubmitted={onSurveyDone}
        />
      )}
    </section>
  );
}
