import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { profile, signoutStars } from '../../data/surveyQuestions';
import { submitSessionSurvey } from '../../api/client';
import StarRating from '../ui/StarRating';

interface SignoutSurveyProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SignoutSurvey({ onComplete, onCancel }: SignoutSurveyProps) {
  const { user } = useAppStore();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Survey is opt-in for every user — including devcon testers. The
  // previous gate that forced testers to fill the form before signing
  // out turned the study into a coercion exercise; testers should
  // consent freely. The "Not interested, just sign out" button is
  // always offered.
  const allProfileAnswered = profile.every((q) => ratings[q.id] >= 1);
  const allRated = signoutStars.every((q) => ratings[q.id] >= 1 && ratings[q.id] <= 5);
  const canSubmit = allProfileAnswered && allRated;
  // Used as the dummy `user` reference so the unused-import lint stays
  // happy; if the prop becomes useful for branching later it stays in
  // scope.
  void user;

  async function onSubmit(): Promise<void> {
    if (!canSubmit) {
      setError('Please complete every profile choice and rate every statement before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitSessionSurvey(ratings, {});
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
        <h2 id="signout-title">Session feedback</h2>
        <p className="modal-lede">
          Before you sign out, please complete your respondent profile and rate your overall experience.
        </p>

        <section className="survey-section">
          <h3 className="survey-section-title">Section A. Respondent Profile</h3>
          {profile.map((q) => (
            <div key={q.id} className="survey-question survey-profile-question">
              <p className="question-text">
                <span className="question-id">{q.id}</span> {q.text}
              </p>
              <div className="profile-choice-row" role="radiogroup" aria-label={`${q.id} choices`}>
                {q.choices.map((c) => {
                  const inputId = `${q.id}-${c.value}`;
                  const checked = ratings[q.id] === c.value;
                  return (
                    <label key={c.value} htmlFor={inputId} className="profile-choice">
                      <input
                        id={inputId}
                        type="radio"
                        name={q.id}
                        value={c.value}
                        checked={checked}
                        onChange={() => setRatings((r) => ({ ...r, [q.id]: c.value }))}
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="survey-section">
          <h3 className="survey-section-title">Sections B–F. System Evaluation</h3>
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
        </section>

        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>
            Back
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={onComplete}
            disabled={busy}
            title="Sign out without submitting the survey"
          >
            Not interested — just sign out
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={() => { void onSubmit(); }}
            disabled={busy || !canSubmit}
          >
            {busy ? 'Submitting…' : 'Submit & sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
