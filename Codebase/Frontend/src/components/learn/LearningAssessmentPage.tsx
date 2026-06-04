import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../logic/router';
import { saveLearningAssessment } from '../../api/client';
import { useAppStore } from '../../store/appState';
import { useLearningModules } from '../../data/useLearningModules';
import {
  buildLearningAssessmentQuestions,
  gradeLearningAssessment,
  LEARNING_ASSESSMENT_META,
  type LearningAssessmentType,
} from '../../data/learningAssessments';

interface LearningAssessmentPageProps {
  assessmentType: LearningAssessmentType;
  autoAdvance?: boolean;
}

function AssessmentChoice({
  name,
  id,
  label,
  picked,
  correct,
  wrong,
  onSelect,
}: {
  name: string;
  id: string;
  label: string;
  picked: boolean;
  correct: boolean;
  wrong: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <label
      htmlFor={id}
      className="nt-assessment__choice"
      data-picked={picked ? 'true' : undefined}
      data-correct={correct ? 'true' : undefined}
      data-wrong={wrong ? 'true' : undefined}
    >
      <input id={id} type="radio" name={name} checked={picked} onChange={onSelect} />
      <span>{label}</span>
    </label>
  );
}

export default function LearningAssessmentPage({
  assessmentType,
  autoAdvance = false,
}: LearningAssessmentPageProps): JSX.Element {
  const meta = LEARNING_ASSESSMENT_META[assessmentType];
  const { modules, loaded } = useLearningModules();
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);

  const questions = useMemo(
    () => (loaded ? buildLearningAssessmentQuestions(modules, assessmentType) : []),
    [assessmentType, loaded, modules],
  );

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setError(null);
  }, [assessmentType]);

  const graded = useMemo(
    () => gradeLearningAssessment(questions, answers),
    [answers, questions],
  );

  const answeredCount = questions.filter((q) => Number.isInteger(answers[q.assessmentIndex])).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const handleSubmit = async (): Promise<void> => {
    if (!allAnswered) {
      setError('Answer every question before submitting.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await saveLearningAssessment({
        assessmentType,
        sessionId: lmsSessionId,
        answers: questions.map((question) => ({
          moduleId: question.moduleId,
          questionIndex: question.questionIndex,
          selectedIndex: Number(answers[question.assessmentIndex]),
        })),
      });

      if (assessmentType === 'pretest') {
        setPreTestCompleted(true);
      }

      if (autoAdvance) {
        navigate(meta.nextPath);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = (): void => {
    navigate(meta.nextPath);
  };

  if (!loaded) {
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`}>
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Loading</span>
              <h1 className="nt-test-page__panel-title">Preparing the assessment</h1>
            </div>
            <p className="nt-test-page__panel-copy">Loading the live module bank.</p>
          </section>
        </div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`}>
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Unavailable</span>
              <h1 className="nt-test-page__panel-title">No theoretical questions are available</h1>
            </div>
            <p className="nt-test-page__panel-copy">
              The module bank needs at least one theoretical question before this assessment can render.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">{meta.eyebrow}</p>
          <div className="nt-test-page__badge nt-test-page__badge--alt">{meta.badge}</div>
          <h1 className="nt-test-page__title">{meta.title}</h1>
          <p className="nt-test-page__lede">{meta.intro}</p>
        </header>

        <section className="nt-test-page__panel">
          <div className="nt-test-page__panel-head">
            <span className="nt-test-page__panel-kicker">
              {answeredCount}/{questions.length} answered
            </span>
            <h2 className="nt-test-page__panel-title">Raw answers only, local scoring in the browser</h2>
          </div>

          <section className="nt-assessment" data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
            <ol className="nt-assessment__items">
              {questions.map((item) => {
                const selected = answers[item.assessmentIndex];
                const picked = Number.isInteger(selected) ? Number(selected) : null;
                const showResult = submitted || autoAdvance;
                const answeredState = picked != null;
                return (
                  <li key={`${item.moduleId}#${item.questionIndex}`}>
                    <p className="nt-assessment__module">
                      <span className="nt-assessment__band">{item.moduleEyebrow}</span> {item.moduleTitle}
                    </p>
                    <p className="nt-assessment__prompt">
                      <span className="nt-assessment__num">Q{item.assessmentIndex + 1}</span>
                      {item.question.question}
                    </p>
                    {item.question.code ? <pre className="nt-assessment__code">{item.question.code}</pre> : null}
                    <ol className="nt-assessment__choices">
                      {item.question.options.map((option, optionIndex) => {
                        const correct = showResult && optionIndex === item.question.correctIndex;
                        const wrong = showResult && answeredState && picked !== item.question.correctIndex && picked === optionIndex;
                        return (
                          <li key={`${item.moduleId}#${item.questionIndex}#${optionIndex}`}>
                            <AssessmentChoice
                              name={`${item.moduleId}-${item.questionIndex}`}
                              id={`${item.moduleId}-${item.questionIndex}-${optionIndex}`}
                              label={option}
                              picked={picked === optionIndex}
                              correct={correct}
                              wrong={wrong}
                              onSelect={() => {
                                setError(null);
                                setAnswers((prev) => ({ ...prev, [item.assessmentIndex]: optionIndex }));
                              }}
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>

            {submitted ? (
              <div className="nt-assessment__result" role="status" aria-live="polite">
                <p className="nt-assessment__score">
                  Browser score: <strong>{graded.correctCount}/{graded.totalCount}</strong> ({graded.scorePercent}%)
                </p>
                <p className="nt-assessment__gain">
                  Only raw selected answers were stored. The score above was computed client-side from the live module bank.
                </p>
              </div>
            ) : null}

            {error ? <p className="nt-assessment__hint" role="alert">{error}</p> : null}

            <div className="nt-assessment__footer">
              {!submitted ? (
                <>
                  <button
                    type="button"
                    className="nt-lesson-button nt-lesson-button--primary"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : meta.submitLabel}
                  </button>
                  <p className="nt-assessment__hint">
                    Selected answers are saved as raw data only. Interpretation stays in the browser.
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="nt-lesson-button nt-lesson-button--primary"
                    onClick={handleContinue}
                  >
                    {meta.continueLabel}
                  </button>
                  <p className="nt-assessment__hint">
                    The database has the raw answers. Continue when you are ready.
                  </p>
                </>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
