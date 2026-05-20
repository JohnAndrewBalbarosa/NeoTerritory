import { useState } from 'react';
import { perRun } from '../../data/surveyQuestions';
import { submitRunSurvey } from '../../api/client';
import StarRating from '../ui/StarRating';

// Pattern catalog universe — must mirror PATTERN_UNIVERSE in
// Codebase/Backend/src/routes/admin.ts /stats/f1-metrics. The "what
// patterns did you intend that weren't detected?" checkbox lists
// everything in this catalog except the ones the analyzer already
// detected for the current run.
const PATTERN_UNIVERSE: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'singleton',          label: 'Singleton' },
  { id: 'factory',            label: 'Factory' },
  { id: 'builder',            label: 'Builder' },
  { id: 'method_chaining',    label: 'Method Chaining' },
  { id: 'strategy_interface', label: 'Strategy Interface' },
  { id: 'adapter',            label: 'Adapter' },
  { id: 'decorator',          label: 'Decorator' },
  { id: 'proxy',              label: 'Proxy' },
  { id: 'virtual_proxy',      label: 'Virtual Proxy' },
  { id: 'pimpl',              label: 'Pimpl' },
];

interface RunSurveyModalProps {
  runKey: string;
  onSubmitted: () => void;
  // Patterns the analyzer already tagged in the just-completed run.
  // Used to filter the "missed" checkbox so the participant only sees
  // patterns that AREN'T already in the analyzer's results.
  detectedPatterns?: string[];
}

export default function RunSurveyModal({ runKey, onSubmitted, detectedPatterns = [] }: RunSurveyModalProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRated = perRun.every((q) => ratings[q.id] >= 1 && ratings[q.id] <= 5);
  const detectedSet = new Set(detectedPatterns);
  const missedOptions = PATTERN_UNIVERSE.filter((p) => !detectedSet.has(p.id));

  function toggleMissed(id: string): void {
    setMissed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function onSubmit(): Promise<void> {
    if (!allRated) {
      setError('Please rate every item before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitRunSurvey(runKey, ratings, {}, {
        surveyMissed: [...missed],
      });
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

        {missedOptions.length > 0 && (
          <div className="survey-question survey-missed-block" data-testid="survey-missed">
            <p className="question-text">
              <span className="question-id">FN</span> Did you intend any of these patterns that the analyzer didn&apos;t tag?
            </p>
            <p className="survey-missed-hint">
              Tick everything you wrote but isn&apos;t in the analyzer&apos;s detection list. Leave it empty if every pattern you intended was already tagged.
            </p>
            <div className="survey-missed-grid">
              {missedOptions.map((p) => (
                <label key={p.id} className="survey-missed-option">
                  <input
                    type="checkbox"
                    checked={missed.has(p.id)}
                    onChange={() => toggleMissed(p.id)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
