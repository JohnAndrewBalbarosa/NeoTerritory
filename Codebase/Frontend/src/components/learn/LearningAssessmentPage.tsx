import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../logic/router';
import { saveLearningAssessment } from '../../api/client';
import { useAppStore } from '../../store/appState';
import { useLearningModules } from '../../data/useLearningModules';
import {
  buildLearningAssessmentAnswerInputs,
  buildLearningAssessmentQuestions,
  gradeLearningAssessment,
  hasLearningAssessmentAnswer,
  LEARNING_ASSESSMENT_META,
  type LearningAssessmentType,
} from '../../data/learningAssessments';
import { AdaptiveAssessmentProvider, useAdaptiveAssessment } from './AdaptiveAssessmentProvider';
import { BloomQuestionRenderer } from './BloomQuestionRenderer';

interface LearningAssessmentPageProps {
  assessmentType: LearningAssessmentType;
  autoAdvance?: boolean;
}

function LearningAssessmentContent({
  assessmentType,
  autoAdvance = false,
}: LearningAssessmentPageProps): JSX.Element {
  const meta = LEARNING_ASSESSMENT_META[assessmentType];
  const { modules, loaded } = useLearningModules();
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);

  const {
    currentLevel,
    status,
    activeModuleIds,
    eliminatedModuleIds,
    nextLevel,
    eliminateModules,
    initializeActiveModules,
    getTaxonomyForLevel,
    getLevelForTaxonomy,
  } = useAdaptiveAssessment();

  const allQuestions = useMemo(
    () => (loaded ? buildLearningAssessmentQuestions(modules, assessmentType) : []),
    [assessmentType, loaded, modules],
  );

  useEffect(() => {
    if (
      loaded &&
      allQuestions.length > 0 &&
      assessmentType === 'pretest' &&
      activeModuleIds.size === 0 &&
      eliminatedModuleIds.size === 0
    ) {
      initializeActiveModules([...new Set(allQuestions.map((q) => q.moduleId))]);
    }
  }, [
    loaded,
    allQuestions,
    assessmentType,
    activeModuleIds.size,
    eliminatedModuleIds.size,
    initializeActiveModules,
  ]);

  const currentTaxonomy = getTaxonomyForLevel(currentLevel);
  const questions = useMemo(() => {
    if (assessmentType !== 'pretest') return allQuestions;
    return allQuestions.filter((q) => q.taxonomy === currentTaxonomy && activeModuleIds.has(q.moduleId));
  }, [allQuestions, assessmentType, currentTaxonomy, activeModuleIds]);

  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [levelSubmitted, setLevelSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswers({});
  }, [assessmentType]);

  useEffect(() => {
    setLevelSubmitted(false);
    setError(null);
  }, [assessmentType, currentLevel]);

  const graded = useMemo(
    () => gradeLearningAssessment(questions, answers),
    [answers, questions],
  );

  const advancingModuleIds = useMemo(() => {
    if (assessmentType !== 'pretest') return [];
    return graded.results.filter((r) => r.isCorrect).map((r) => r.moduleId);
  }, [assessmentType, graded.results]);

  const failedInThisLevelIds = useMemo(() => {
    if (assessmentType !== 'pretest') return [];
    return graded.results.filter((r) => !r.isCorrect).map((r) => r.moduleId);
  }, [assessmentType, graded.results]);

  const answeredCount = questions.filter((q) => hasLearningAssessmentAnswer(q.question, answers[q.assessmentIndex])).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const answeredTotal = allQuestions.filter((q) => hasLearningAssessmentAnswer(q.question, answers[q.assessmentIndex])).length;
  const levelProgress = useMemo(() => {
    if (assessmentType !== 'pretest') return [];
    return allQuestions.reduce<Array<{
      level: number;
      taxonomy: ReturnType<typeof getTaxonomyForLevel>;
      total: number;
      answered: number;
      active: boolean;
    }>>((acc, question) => {
      const level = getLevelForTaxonomy(question.taxonomy);
      let entry = acc.find((item) => item.level === level);
      if (!entry) {
        entry = {
          level,
          taxonomy: question.taxonomy,
          total: 0,
          answered: 0,
          active: level === currentLevel,
        };
        acc.push(entry);
      }
      if (activeModuleIds.has(question.moduleId) || hasLearningAssessmentAnswer(question.question, answers[question.assessmentIndex])) {
        entry.total += 1;
      }
      if (hasLearningAssessmentAnswer(question.question, answers[question.assessmentIndex])) {
        entry.answered += 1;
      }
      return acc;
    }, []).sort((a, b) => a.level - b.level);
  }, [activeModuleIds, allQuestions, answers, assessmentType, currentLevel, getLevelForTaxonomy]);

  const handleSubmitLevel = async (): Promise<void> => {
    if (!allAnswered) {
      setError('Answer every question in this level before submitting.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (assessmentType === 'pretest') {
        const { setMasteredLevels, masteredLevelsByModule } = useAppStore.getState();

        graded.results.forEach((result) => {
          if (result.isCorrect) {
            const existing = masteredLevelsByModule[result.moduleId] || [];
            setMasteredLevels(result.moduleId, [...new Set([...existing, currentLevel])]);
          }
        });

        if (failedInThisLevelIds.length > 0) {
          eliminateModules(failedInThisLevelIds);
        }

        const nextActiveSize = activeModuleIds.size - failedInThisLevelIds.length;
        if (currentLevel === 6 || nextActiveSize === 0) {
          await finalizeAssessment();
        } else {
          setLevelSubmitted(true);
        }
      } else {
        await finalizeAssessment();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the level results.');
    } finally {
      setSaving(false);
    }
  };

  const finalizeAssessment = async () => {
    const finalAnswers = buildLearningAssessmentAnswerInputs(
      assessmentType === 'pretest' ? allQuestions : questions,
      answers,
    );

    await saveLearningAssessment({
      assessmentType,
      sessionId: lmsSessionId,
      answers: finalAnswers,
    });

    if (assessmentType === 'pretest') {
      setPreTestCompleted(true);
    }

    if (autoAdvance) {
      navigate(meta.nextPath);
      return;
    }

    setLevelSubmitted(true);
  };

  const handleContinue = (): void => {
    if (assessmentType === 'pretest' && status === 'in_progress' && currentLevel < 6 && activeModuleIds.size > 0) {
      nextLevel();
    } else {
      navigate(meta.nextPath);
    }
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

  if (allQuestions.length === 0) {
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
              {assessmentType === 'pretest'
                ? `Level ${currentLevel}: ${currentTaxonomy} (${answeredCount}/${questions.length} answered, ${answeredTotal} saved so far)`
                : `${answeredCount}/${questions.length} answered`}
            </span>
            <h2 className="nt-test-page__panel-title">Adaptive Bloom's Assessment</h2>
          </div>

          <section className="nt-assessment" data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
            {assessmentType === 'pretest' ? (
              <div className="nt-assessment__stepper" aria-label="Bloom assessment progress">
                {levelProgress.map((level) => (
                  <div
                    key={level.level}
                    className="nt-assessment__step"
                    data-active={level.active}
                    data-complete={level.answered > 0 && level.answered === level.total}
                    data-empty={level.total === 0}
                  >
                    <span className="nt-assessment__step-num">{level.level}</span>
                    <span className="nt-assessment__step-label">{level.taxonomy}</span>
                    <span className="nt-assessment__step-count">{level.answered}/{level.total}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <ol className="nt-assessment__items">
              {questions.map((item) => {
                const selected = answers[item.assessmentIndex];
                const showResult = levelSubmitted;
                return (
                  <li key={`${item.moduleId}#${item.questionIndex}`}>
                    <p className="nt-assessment__module">
                      <span className="nt-assessment__band">{item.moduleEyebrow}</span> {item.moduleTitle}
                      <span className="nt-assessment__taxonomy" data-taxonomy={item.taxonomy}>
                        {item.taxonomy}
                      </span>
                    </p>
                    <BloomQuestionRenderer
                      question={item.question}
                      userAnswer={selected}
                      showResult={showResult}
                      onAnswer={(val) => {
                        setError(null);
                        setAnswers((prev) => ({ ...prev, [item.assessmentIndex]: val }));
                      }}
                    />
                  </li>
                );
              })}
            </ol>

            {levelSubmitted ? (
              <div className="nt-assessment__result" role="status" aria-live="polite">
                <p className="nt-assessment__score">
                  {assessmentType === 'pretest' ? `Level ${currentLevel}` : 'Assessment'} score:{' '}
                  <strong>{graded.correctCount}/{graded.totalCount}</strong>
                </p>
                {assessmentType === 'pretest' ? (
                  <>
                    {advancingModuleIds.length > 0 && (
                      <p className="nt-assessment__gain">
                        Modules advancing to Level {currentLevel + 1}:{' '}
                        <strong>
                          {advancingModuleIds
                            .map((id) => modules.find((m) => m.id === id)?.title)
                            .join(', ')}
                        </strong>
                      </p>
                    )}
                    {failedInThisLevelIds.length > 0 && (
                      <p className="nt-assessment__gain nt-assessment__gain--fail">
                        Modules eliminated and added to study list:{' '}
                        <strong>
                          {failedInThisLevelIds
                            .map((id) => modules.find((m) => m.id === id)?.title)
                            .join(', ')}
                        </strong>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {graded.correctCount === graded.totalCount ? (
                      <p className="nt-assessment__gain">Excellent! You have mastered this assessment.</p>
                    ) : (
                      <p className="nt-assessment__gain">You missed some questions in this level.</p>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {error ? <p className="nt-assessment__hint" role="alert">{error}</p> : null}

            <div className="nt-assessment__footer">
              {!levelSubmitted ? (
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={handleSubmitLevel}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : assessmentType === 'pretest' ? 'Submit Level' : meta.submitLabel}
                </button>
              ) : (
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={handleContinue}
                >
                  {status === 'completed' || currentLevel === 6 || (assessmentType === 'pretest' && activeModuleIds.size === 0)
                    ? meta.continueLabel
                    : 'Continue to Next Level'}
                </button>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

export default function LearningAssessmentPage(props: LearningAssessmentPageProps): JSX.Element {
  return (
    <AdaptiveAssessmentProvider>
      <LearningAssessmentContent {...props} />
    </AdaptiveAssessmentProvider>
  );
}
