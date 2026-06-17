import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../logic/router';
import { fetchLearningProgress, saveLearningAssessment, saveLearningProgress, refreshGuest } from '../../api/client';
import { useAppStore } from '../../store/appState';
import { useLearningModules } from '../../data/useLearningModules';
import { isStudioQuestion } from '../../data/learningModules';
import {
  buildLearningAssessmentAnswerInputs,
  buildLearningAssessmentQuestions,
  gradeLearningAssessment,
  hasLearningAssessmentAnswer,
  LEARNING_ASSESSMENT_META,
  type LearningAssessmentType,
} from '../../data/learningAssessments';
import { bloomTaxonomiesThroughLevel } from '../../logic/pretestModuleOutcomes';
import { AdaptiveAssessmentProvider, useAdaptiveAssessment } from './AdaptiveAssessmentProvider';
import { BloomQuestionRenderer } from './BloomQuestionRenderer';

interface LearningAssessmentPageProps {
  assessmentType: LearningAssessmentType;
  autoAdvance?: boolean;
}

function clampBloomLevel(level: number): number {
  return Math.max(0, Math.min(6, Math.floor(level)));
}

function masteryLevelFromStoredLevels(levels: ReadonlyArray<number> | undefined): number {
  return clampBloomLevel(Math.max(0, ...(levels ?? [])));
}

function masteryMapFromLocalStore(masteredLevelsByModule: Record<string, number[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [moduleId, levels] of Object.entries(masteredLevelsByModule)) {
    const level = masteryLevelFromStoredLevels(levels);
    if (level > 0) out[moduleId] = level;
  }
  return out;
}

function LearningAssessmentContent({
  assessmentType,
  autoAdvance = false,
}: LearningAssessmentPageProps): JSX.Element {
  const meta = LEARNING_ASSESSMENT_META[assessmentType];
  const { modules, loaded } = useLearningModules();
  const token = useAppStore((s) => s.token);
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
  const learningListModuleIds = useMemo(() => {
    if (assessmentType !== 'pretest') return [];
    const ids = new Set(eliminatedModuleIds);
    if (levelSubmitted) {
      failedInThisLevelIds.forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }, [assessmentType, eliminatedModuleIds, failedInThisLevelIds, levelSubmitted]);
  const currentLevelQuestionCount = questions.length;
  const activeModuleCount = assessmentType === 'pretest' ? activeModuleIds.size : 0;

  const answeredCount = questions.filter((q) => hasLearningAssessmentAnswer(q.question, answers[q.assessmentIndex])).length;
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

  const submitLevel = async (answersToSubmit: Record<number, any> = answers): Promise<void> => {
    const allAnsweredForSubmit = questions.length > 0 && questions.every((q) =>
      hasLearningAssessmentAnswer(q.question, answersToSubmit[q.assessmentIndex])
    );
    const hasPendingStudioForSubmit = questions.some((q) =>
      isStudioQuestion(q.question) && !hasLearningAssessmentAnswer(q.question, answersToSubmit[q.assessmentIndex])
    );

    if (!allAnsweredForSubmit) {
      if (hasPendingStudioForSubmit) {
        setError('You must complete all Studio tasks (open the Studio and successfully detect the pattern) before submitting.');
      } else {
        setError('Answer every question completely in this level before submitting. Ensure all fill-in-the-blanks are filled.');
      }
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const gradedForSubmit = gradeLearningAssessment(questions, answersToSubmit);
      const failedIdsForSubmit = [...new Set(
        assessmentType === 'pretest'
          ? gradedForSubmit.results.filter((r) => !r.isCorrect).map((r) => r.moduleId)
          : []
      )];

      if (assessmentType === 'pretest') {
        const { setMasteredLevels, masteredLevelsByModule } = useAppStore.getState();

        gradedForSubmit.results.forEach((result) => {
          if (result.isCorrect) {
            const existing = masteredLevelsByModule[result.moduleId] || [];
            const nextLevel = Math.max(masteryLevelFromStoredLevels(existing), currentLevel);
            setMasteredLevels(result.moduleId, bloomTaxonomiesThroughLevel(nextLevel).map((_, index) => index + 1));
          }
        });

        if (failedIdsForSubmit.length > 0) {
          eliminateModules(failedIdsForSubmit);
        }

        const nextActiveSize = activeModuleIds.size - failedIdsForSubmit.length;
        if (currentLevel === 6 || nextActiveSize === 0) {
          await finalizeAssessment(answersToSubmit);
        } else {
          setLevelSubmitted(true);
        }
      } else {
        await finalizeAssessment(answersToSubmit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the level results.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitLevel = async (): Promise<void> => {
    await submitLevel();
  };

  const finalizeAssessment = async (answersToSubmit: Record<number, any> = answers) => {
    const finalAnswers = buildLearningAssessmentAnswerInputs(
      assessmentType === 'pretest' ? allQuestions : questions,
      answersToSubmit,
    );

    await saveLearningAssessment({
      assessmentType,
      sessionId: lmsSessionId,
      answers: finalAnswers,
    });

    // D93: proactive session refresh for guests on major action completion.
    const user = useAppStore.getState().user;
    if (user?.role === 'guest') {
      try {
        const { token: freshToken, user: freshUser } = await refreshGuest();
        useAppStore.getState().setAuth(freshToken, freshUser);
      } catch (err) {
        console.warn('[assessment] proactive guest refresh failed:', err);
      }
    }

    if (assessmentType === 'pretest') {
      setPreTestCompleted(true);
      if (token) {
        try {
          const progress = await fetchLearningProgress();
          const bloomMasteryByModule = {
            ...(progress.bloomMasteryByModule ?? {}),
            ...masteryMapFromLocalStore(useAppStore.getState().masteredLevelsByModule),
          };
          await saveLearningProgress(
            progress.completedModuleIds,
            progress.lastUnlockedModuleId,
            undefined,
            progress.theoryPassedModuleIds ?? [],
            lmsSessionId ?? undefined,
            bloomMasteryByModule,
          );
        } catch (err) {
          console.error('Failed to persist Bloom mastery progress:', err);
        }
      }
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
                ? `Level ${currentLevel}: ${currentTaxonomy} (${answeredCount}/${currentLevelQuestionCount} answered, ${activeModuleCount} still active, ${learningListModuleIds.length} to learn)`
                : `${answeredCount}/${questions.length} answered`}
            </span>
            <h2 className="nt-test-page__panel-title">Adaptive Bloom's Assessment</h2>
          </div>

          <section className="nt-assessment" data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
            {assessmentType === 'pretest' && activeModuleCount > 0 && currentLevelQuestionCount !== activeModuleCount ? (
              <p className="nt-assessment__hint">
                This Bloom level has {currentLevelQuestionCount} question{currentLevelQuestionCount === 1 ? '' : 's'} for {activeModuleCount} still-active module{activeModuleCount === 1 ? '' : 's'}.
                Modules without a {currentTaxonomy} question stay in the pool for the next level.
              </p>
            ) : null}

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
                        Modules added to learning list ({learningListModuleIds.length} total):{' '}
                        <strong>
                          {failedInThisLevelIds
                            .map((id) => modules.find((m) => m.id === id)?.title)
                            .join(', ')}
                        </strong>
                      </p>
                    )}
                    {(currentLevel === 6 || activeModuleIds.size === 0) && activeModuleIds.size > 0 ? (
                      <p className="nt-assessment__gain">
                        Modules exempted by pre-test mastery:{' '}
                        <strong>
                          {Array.from(activeModuleIds)
                            .map((id) => modules.find((m) => m.id === id)?.title)
                            .filter(Boolean)
                            .join(', ')}
                        </strong>
                      </p>
                    ) : null}
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
