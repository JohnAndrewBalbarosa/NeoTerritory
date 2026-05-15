import { useState } from 'react';
import { perRun } from '../../data/surveyQuestions';
import { submitRunSurvey } from '../../api/client';
import StarRating from '../ui/StarRating';

interface RunSurveyModalProps {
  runKey: string;
  onSubmitted: () => void;
}

export default function RunSurveyModal({ runKey, onSubmitted }: RunSurveyModalProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRated = perRun.every((q) => ratings[q.id] >= 1 && ratings[q.id] <= 5);

  async function onSubmit(): Promise<void> {
    if (!allRated) {
      setError('Please rate every item before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitRunSurvey(runKey, ratings, {});
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay run-survey" role="dialog" aria-modal="true" aria-labelledby="run-survey-title">
      <div className="modal-card run-survey-card">
        <h2 id="run-survey-title">Quick check on the last analysis</h2>
        <p className="modal-lede">
          Before re-running, please rate the previous run.
        </p>
        {perRun.map((q) => (
          <div key={q.id} className="survey-question">
            <p className="question-text">
              <span className="question-id">{q.id}</span> {q.text}
            </p>
            <StarRating
              value={ratings[q.id] || 0}
              onChange={(v) => setRatings((r) => ({ ...r, [q.id]: v }))}
              label={`${q.id} rating`}
            />
          </div>
        ))}
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="modal-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={() => { void onSubmit(); }}
            disabled={busy || !allRated}
          >
            {busy ? 'Submitting…' : 'Submit & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
