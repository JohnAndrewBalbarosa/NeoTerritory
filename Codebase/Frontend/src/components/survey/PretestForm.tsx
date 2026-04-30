import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { submitPretest } from '../../api/client';
import { pretest } from '../../data/surveyQuestions';
import StarRating from '../ui/StarRating';

export default function PretestForm() {
  const { setPretestSubmitted } = useAppStore();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-skip when the pretest array is empty (validated wording not yet available).
  useEffect(() => {
    if (pretest.length === 0) {
      setPretestSubmitted(true);
    }
  }, [setPretestSubmitted]);

  if (pretest.length === 0) return null;

  async function onSubmit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await submitPretest(answers);
      setPretestSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit pre-test.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay pretest-gate" role="dialog" aria-modal="true" aria-labelledby="pretest-title">
      <div className="modal-card pretest-card">
        <h2 id="pretest-title">Pre-Test (Respondent Profile)</h2>
        {pretest.map((q) => (
          <div key={q.id} className="survey-question">
            <p className="question-text">
              <span className="question-id">{q.id}</span> {q.text}
            </p>
            {q.kind === 'star' ? (
              <StarRating
                value={Number(answers[q.id] || 0)}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                label={`${q.id} rating`}
              />
            ) : (
              <textarea
                value={String(answers[q.id] || '')}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
              />
            )}
          </div>
        ))}
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="modal-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={() => { void onSubmit(); }}
            disabled={busy}
          >
            {busy ? 'Submitting…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
