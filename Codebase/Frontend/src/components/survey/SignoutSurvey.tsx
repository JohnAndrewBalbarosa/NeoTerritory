import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { signoutStars } from '../../data/surveyQuestions';
import { submitSessionSurvey } from '../../api/client';
import StarRating from '../ui/StarRating';

interface SignoutSurveyProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SignoutSurvey({ onComplete, onCancel }: SignoutSurveyProps) {
  const { user } = useAppStore();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [open] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDevcon = (user?.username || '').toLowerCase().startsWith('devcon');
  const canSkip = !isDevcon;
  const allRated = signoutStars.every((q) => ratings[q.id] >= 1 && ratings[q.id] <= 5);

  async function onSubmit(): Promise<void> {
    if (!allRated) {
      setError('Please rate every item before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitSessionSurvey(ratings, open);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay signout-survey signout-takeover" role="dialog" aria-modal="true" aria-labelledby="signout-title">
      <div className="modal-card signout-card">
        <div className="signout-card__header">
          <h2 id="signout-title">Session feedback</h2>
          <p className="modal-lede">
            Before you sign out, please rate your overall experience with the system.
          </p>
        </div>

        <div className="signout-card__body">
          {signoutStars.map((q) => (
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
          {/* open-ended textarea questions hidden from visible UI; open state still submitted */}
          {error && <div className="error-banner" role="alert">{error}</div>}
        </div>

        <div className="signout-card__footer">
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>
            Back
          </button>
          {canSkip && (
            <button className="ghost-btn" type="button" onClick={onComplete} disabled={busy}>
              Skip
            </button>
          )}
          <button
            className="primary-btn"
            type="button"
            onClick={() => { void onSubmit(); }}
            disabled={busy || !allRated}
          >
            {busy ? 'Submitting…' : 'Submit & sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
