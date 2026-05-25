import { useMemo, useState } from 'react';
import {
  type AssessmentForm,
  type AssessmentScoreResult,
  scoreAssessment,
  normalizedGain,
  proficiencyFor,
  type ProficiencyBand,
} from '../../data/learningAssessments';

interface AssessmentPanelProps {
  form: AssessmentForm;
  // Pre-test score for the SAME scope, if already taken — lets a post-test
  // panel show the improvement and normalized gain inline.
  prePercent?: number | null;
  // Admin-configured proficiency bands (falls back to defaults inside the
  // scoring helpers when omitted).
  bands?: ReadonlyArray<ProficiencyBand>;
  // Fired once the learner submits. The parent persists the result and
  // decides what to unlock next.
  onComplete: (result: AssessmentScoreResult, answers: Record<string, number>) => void;
  // When true, the submit button shows a busy state (parent is persisting).
  submitting?: boolean;
}

// One knowledge-test form (pre or post), MCQ + code-reading items. This is the
// objective learning measure that replaces a guessable Likert questionnaire:
// every item has a correct answer, so the score means something.
export default function AssessmentPanel({
  form,
  prePercent,
  bands,
  onComplete,
  submitting,
}: AssessmentPanelProps): JSX.Element {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentScoreResult | null>(null);

  const allAnswered = useMemo(
    () => form.items.every((it) => answers[it.id] != null),
    [form.items, answers],
  );

  function handleSubmit(): void {
    if (!allAnswered) return;
    const scored = scoreAssessment(form, answers);
    setResult(scored);
    onComplete(scored, answers);
  }

  const gain =
    result != null && prePercent != null && form.phase === 'post'
      ? normalizedGain(prePercent, result.percent)
      : null;

  return (
    <section
      className="nt-assessment"
      data-phase={form.phase}
      aria-label={form.title}
      data-testid={`assessment-${form.scope}-${form.phase}`}
    >
      <header className="nt-assessment__head">
        <p className="nt-assessment__eyebrow">
          {form.phase === 'pre' ? 'Pre-test · Knowledge check' : 'Post-test · Knowledge check'}
        </p>
        <h2 className="nt-assessment__title">{form.title}</h2>
        <p className="nt-assessment__intro">{form.intro}</p>
      </header>

      <ol className="nt-assessment__items">
        {form.items.map((item, idx) => (
          <li key={item.id} className="nt-assessment__item">
            <p className="nt-assessment__prompt">
              <span className="nt-assessment__num">{idx + 1}.</span> {item.prompt}
            </p>
            {item.code ? (
              <pre className="nt-assessment__code" aria-label="Code to read">
                {item.code}
              </pre>
            ) : null}
            <ul className="nt-assessment__choices">
              {item.options.map((opt, oi) => {
                const picked = answers[item.id] === oi;
                const locked = result != null;
                const isCorrect = locked && oi === item.correctIndex;
                const isWrongPick = locked && picked && oi !== item.correctIndex;
                return (
                  <li key={oi}>
                    <label
                      className="nt-assessment__choice"
                      data-picked={picked ? 'true' : undefined}
                      data-correct={isCorrect ? 'true' : undefined}
                      data-wrong={isWrongPick ? 'true' : undefined}
                    >
                      <input
                        type="radio"
                        name={item.id}
                        checked={picked}
                        disabled={locked}
                        onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))}
                      />
                      <span>{opt}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      {result == null ? (
        <div className="nt-assessment__footer">
          <button
            type="button"
            className="nt-lesson-button nt-lesson-button--primary"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            title={allAnswered ? undefined : 'Answer every item to submit.'}
          >
            {submitting ? 'Submitting…' : form.phase === 'pre' ? 'Submit pre-test' : 'Submit post-test'}
          </button>
          {!allAnswered && (
            <p className="nt-assessment__hint">
              {form.items.length - Object.keys(answers).length} item(s) left.
            </p>
          )}
        </div>
      ) : (
        <div className="nt-assessment__result" role="status">
          <p className="nt-assessment__score">
            Score: <strong>{result.correct}/{result.total}</strong> ({result.percent}%) ·{' '}
            <span className="nt-assessment__band">{proficiencyFor(result.percent, bands)}</span>
          </p>
          {form.phase === 'post' && prePercent != null && (
            <p className="nt-assessment__gain">
              Pre-test was {prePercent}%. Raw gain: {result.percent - prePercent >= 0 ? '+' : ''}
              {result.percent - prePercent} pts
              {gain != null && (
                <> · normalized gain ⟨g⟩ = {gain.toFixed(2)}</>
              )}
              .
            </p>
          )}
        </div>
      )}
    </section>
  );
}
