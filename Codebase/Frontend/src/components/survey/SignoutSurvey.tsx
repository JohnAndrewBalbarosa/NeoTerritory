import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { signoutStars, openEnded } from '../../data/surveyQuestions';
import { submitSessionSurvey } from '../../api/client';
import StarRating from '../ui/StarRating';

interface SignoutSurveyProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SignoutSurvey({ onComplete, onCancel }: SignoutSurveyProps) {
  const { user } = useAppStore();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<string, string>>({});
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
        <div className="codineo-brand-header">
          <div className="codineo-brand-mark" aria-hidden>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="16" height="11" rx="2" />
              <path d="M7 18h6M10 14v4" />
              <path d="M6 8l2 2-2 2M11 10h3" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <div className="codineo-brand-name">CodiNeo</div>
            <div className="codineo-brand-sub">DEVCON 1 · Code Intelligence</div>
          </div>
        </div>
        <h2 id="signout-title">Session feedback</h2>
        <p className="modal-lede">
          Before you sign out, please rate your overall experience with the system.
        </p>
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
        {openEnded.signout.map((q) => (
          <div key={q.id} className="survey-question">
            <p className="question-text">
              <span className="question-id">{q.id}</span> {q.text}
            </p>
            <textarea
              value={open[q.id] || ''}
              onChange={(e) => setOpen((o) => ({ ...o, [q.id]: e.target.value }))}
              rows={3}
            />
          </div>
        ))}
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="modal-actions">
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
