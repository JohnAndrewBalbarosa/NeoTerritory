import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../logic/router';
import {
  fetchLearningAssessments,
  fetchLearningProgress,
  gradeLearningAssessmentOnServer,
  refreshGuest,
  saveLearningAssessment,
  saveLearningProgress,
} from '../../api/client';
import { useAppStore } from '../../store/appState';
import type { LearningAssessmentGradeResponse } from '../../types/api';
import { BLOOM_TAXONOMIES, type BloomTaxonomy } from '../../data/learningModules';
import { useLearningModules } from '../../data/useLearningModules';
import {
  buildLearningAssessmentAnswerInputs,
  buildLearningAssessmentQuestions,
  computeLearningGain,
  hasLearningAssessmentAnswer,
  LEARNING_ASSESSMENT_META,
  moduleProficiencyStatus,
  PROFICIENCY_THRESHOLD,
  scoreLearningAssessment,
  scoreStoredObjectiveAssessment,
  type AssessmentScore,
  type LearningAssessmentType,
  type LearningGain,
  type ModuleScore,
} from '../../data/learningAssessments';
import {
  bloomTaxonomiesThroughLevel,
  deriveContiguousBloomMastery,
} from '../../logic/pretestModuleOutcomes';
import { resolvePreTestNext } from '../../logic/learnerRouting';
import { BloomQuestionRenderer } from './BloomQuestionRenderer';

interface LearningAssessmentPageProps {
  assessmentType: LearningAssessmentType;
  autoAdvance?: boolean;
}

// ---------------------------------------------------------------------------
// Pre-test draft persistence (survives page reloads mid-assessment)
// ---------------------------------------------------------------------------

interface PretestDraft {
  currentLevel: number;
  answers: Record<number, unknown>;
  levelGrades: Record<number, LearningAssessmentGradeResponse>;
}

const PRETEST_DRAFT_PREFIX = 'nt_lms_pretest_draft';

function clampBloomLevel(level: number): number {
  return Math.max(0, Math.min(6, Math.floor(level)));
}

function titleCaseTaxonomy(taxonomy: BloomTaxonomy): string {
  return taxonomy.charAt(0).toUpperCase() + taxonomy.slice(1);
}

function draftKey(userId: number | undefined, sessionId: string | null): string | null {
  return userId ? `${PRETEST_DRAFT_PREFIX}:${userId}:${sessionId ?? 'default'}` : null;
}

function readPretestDraft(key: string | null): PretestDraft | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Partial<PretestDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      currentLevel: Math.max(1, clampBloomLevel(Number(parsed.currentLevel) || 1)),
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      levelGrades: parsed.levelGrades && typeof parsed.levelGrades === 'object' ? parsed.levelGrades : {},
    };
  } catch {
    return null;
  }
}

function writePretestDraft(key: string | null, draft: PretestDraft): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // The assessment remains usable in memory when storage is unavailable.
  }
}

function clearPretestDraft(key: string | null): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures after the server has saved the attempt.
  }
}

// ---------------------------------------------------------------------------
// Result display components (from main — Post-test learning-gain summary)
// ---------------------------------------------------------------------------

function statusLabel(percent: number): 'Proficient' | 'Recommended for Study' {
  return moduleProficiencyStatus(percent) === 'proficient' ? 'Proficient' : 'Recommended for Study';
}

function ModuleResultRow({ row }: { row: ModuleScore }): JSX.Element {
  const proficient = moduleProficiencyStatus(row.percent) === 'proficient';
  return (
    <li className="nt-results__module" data-status={proficient ? 'proficient' : 'recommended'}>
      <span className="nt-results__module-name">{row.moduleTitle}</span>
      <span className="nt-results__module-score">
        {row.correct} of {row.total} correct · {row.percent}%
      </span>
      <span className="nt-results__badge" data-status={proficient ? 'proficient' : 'recommended'}>
        {statusLabel(row.percent)}
      </span>
      <span className="nt-results__module-rec">
        {proficient ? 'Optional Review' : 'Required'}
      </span>
    </li>
  );
}

function PreTestResults({ score }: { score: AssessmentScore }): JSX.Element {
  const rows = Object.values(score.byModule).sort((a, b) => {
    const aProf = a.percent >= PROFICIENCY_THRESHOLD ? 1 : 0;
    const bProf = b.percent >= PROFICIENCY_THRESHOLD ? 1 : 0;
    if (aProf !== bProf) return aProf - bProf; // recommended (required) first
    return a.moduleTitle.localeCompare(b.moduleTitle);
  });
  const required = rows.filter((r) => r.percent < PROFICIENCY_THRESHOLD);
  const optional = rows.filter((r) => r.percent >= PROFICIENCY_THRESHOLD);

  return (
    <>
      <section className="nt-results__block">
        <h3 className="nt-results__heading">Pre-Test Summary</h3>
        <p className="nt-results__overall">
          Overall score: <strong>{score.correct} of {score.total} correct · {score.percent}%</strong>
        </p>
        <p className="nt-results__overall-status">
          {score.percent >= PROFICIENCY_THRESHOLD ? 'Proficient overall' : 'Below proficiency overall'} — modules below {PROFICIENCY_THRESHOLD}% are recommended for study.
        </p>
      </section>

      <section className="nt-results__block">
        <h3 className="nt-results__heading">Module Results</h3>
        <ul className="nt-results__modules">
          {rows.map((row) => (
            <ModuleResultRow key={row.moduleId} row={row} />
          ))}
        </ul>
      </section>

      <section className="nt-results__block">
        <h3 className="nt-results__heading">Your Learning Path</h3>
        <div className="nt-results__paths">
          <div className="nt-results__path">
            <h4 className="nt-results__path-title">Recommended for study ({required.length})</h4>
            {required.length > 0 ? (
              <ul className="nt-results__path-list">
                {required.map((r) => <li key={r.moduleId}>{r.moduleTitle} — {r.percent}%</li>)}
              </ul>
            ) : (
              <p className="nt-results__path-empty">None — you scored at or above {PROFICIENCY_THRESHOLD}% on every module.</p>
            )}
          </div>
          <div className="nt-results__path">
            <h4 className="nt-results__path-title">Optional review ({optional.length})</h4>
            {optional.length > 0 ? (
              <ul className="nt-results__path-list">
                {optional.map((r) => <li key={r.moduleId}>{r.moduleTitle} — {r.percent}% (Already Proficient)</li>)}
              </ul>
            ) : (
              <p className="nt-results__path-empty">None yet — these appear once you reach {PROFICIENCY_THRESHOLD}%+ on a module.</p>
            )}
          </div>
        </div>
        <p className="nt-results__note">Proficiency is not the same as completion — proficient modules stay open for optional review and do not block your required path.</p>
      </section>
    </>
  );
}

function PostTestResults({ score, gain }: { score: AssessmentScore; gain: LearningGain | null }): JSX.Element {
  return (
    <>
      <section className="nt-results__block">
        <h3 className="nt-results__heading">Post-Test Summary</h3>
        <p className="nt-results__overall">
          Overall score: <strong>{score.correct} of {score.total} correct · {score.percent}%</strong>
        </p>
        <p className="nt-results__overall-status">
          Final proficiency: {score.percent >= PROFICIENCY_THRESHOLD ? 'Proficient' : 'Below proficiency'}
        </p>
      </section>

      {gain ? (
        <section className="nt-results__block">
          <h3 className="nt-results__heading">Learning-Gain Summary</h3>
          <p className="nt-results__overall">
            Pre-test: <strong>{gain.prePercent}%</strong> → Post-test: <strong>{gain.postPercent}%</strong>
          </p>
          <p className="nt-results__gain" data-sign={gain.gainPoints > 0 ? 'pos' : gain.gainPoints < 0 ? 'neg' : 'zero'}>
            Learning gain: <strong>{gain.gainPoints > 0 ? '+' : ''}{gain.gainPoints} percentage points</strong>
            {gain.maintained ? <span className="nt-results__maintained"> · Maintained proficiency</span> : null}
          </p>
          <h4 className="nt-results__path-title">Per-module gain</h4>
          <ul className="nt-results__modules">
            {gain.byModule
              .slice()
              .sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle))
              .map((m) => (
                <li key={m.moduleId} className="nt-results__module">
                  <span className="nt-results__module-name">{m.moduleTitle}</span>
                  <span className="nt-results__module-score">{m.prePercent}% → {m.postPercent}%</span>
                  <span className="nt-results__gain" data-sign={m.gainPoints > 0 ? 'pos' : m.gainPoints < 0 ? 'neg' : 'zero'}>
                    {m.gainPoints > 0 ? '+' : ''}{m.gainPoints} pp{m.maintained ? ' · maintained' : ''}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : (
        <section className="nt-results__block">
          <p className="nt-results__note">No comparable pre-test on record, so a learning-gain comparison is not available.</p>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LearningAssessmentPage({
  assessmentType,
  autoAdvance = false,
}: LearningAssessmentPageProps): JSX.Element {
  const meta = LEARNING_ASSESSMENT_META[assessmentType];
  const { modules, loaded } = useLearningModules();
  const token = useAppStore((s) => s.token);
  const userId = useAppStore((s) => s.user?.id);
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);
  const pretestDraftKey = useMemo(() => draftKey(userId, lmsSessionId), [lmsSessionId, userId]);
  const initialDraft = useMemo(
    () => (assessmentType === 'pretest' ? readPretestDraft(pretestDraftKey) : null),
    [assessmentType, pretestDraftKey],
  );

  const allQuestions = useMemo(
    () => (loaded ? buildLearningAssessmentQuestions(modules, assessmentType) : []),
    [assessmentType, loaded, modules],
  );

  const [currentLevel, setCurrentLevel] = useState(initialDraft?.currentLevel ?? 1);
  const currentTaxonomy = BLOOM_TAXONOMIES[currentLevel - 1] ?? BLOOM_TAXONOMIES[0];
  const questions = useMemo(
    () => assessmentType === 'pretest'
      ? allQuestions.filter((question) => question.taxonomy === currentTaxonomy)
      : allQuestions,
    [allQuestions, assessmentType, currentTaxonomy],
  );

  const [answers, setAnswers] = useState<Record<number, unknown>>(initialDraft?.answers ?? {});
  const [levelGrades, setLevelGrades] = useState<Record<number, LearningAssessmentGradeResponse>>(
    initialDraft?.levelGrades ?? {},
  );
  const [levelSubmitted, setLevelSubmitted] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gain, setGain] = useState<LearningGain | null>(null);
  const levelGrade = levelGrades[currentLevel] ?? null;

  useEffect(() => {
    if (assessmentType !== 'pretest' || assessmentComplete) return;
    writePretestDraft(pretestDraftKey, { currentLevel, answers, levelGrades });
  }, [answers, assessmentComplete, assessmentType, currentLevel, levelGrades, pretestDraftKey]);

  useEffect(() => {
    setLevelSubmitted(Boolean(levelGrades[currentLevel]));
    setError(null);
  }, [currentLevel, levelGrades]);

  const answeredCount = questions.filter((question) =>
    hasLearningAssessmentAnswer(question.question, answers[question.assessmentIndex])
  ).length;

  const levelProgress = useMemo(() => {
    if (assessmentType !== 'pretest') return [];
    return BLOOM_TAXONOMIES.map((taxonomy, index) => {
      const level = index + 1;
      const grade = levelGrades[level];
      const levelQuestions = allQuestions.filter((question) => question.taxonomy === taxonomy);
      return {
        level,
        taxonomy,
        total: levelQuestions.length,
        answered: levelQuestions.filter((question) =>
          hasLearningAssessmentAnswer(question.question, answers[question.assessmentIndex])
        ).length,
        correct: grade?.correctCount ?? null,
        active: level === currentLevel,
        complete: Boolean(grade),
      };
    });
  }, [allQuestions, answers, assessmentType, currentLevel, levelGrades]);

  const finalizeAssessment = async (
    answersToSubmit: Record<number, unknown>,
  ): Promise<LearningAssessmentGradeResponse> => {
    const finalGrade = await saveLearningAssessment({
      assessmentType,
      sessionId: lmsSessionId,
      answers: buildLearningAssessmentAnswerInputs(
        assessmentType === 'pretest' ? allQuestions : questions,
        answersToSubmit,
      ),
    });

    // Proactive guest session refresh on a major action.
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
      const bloomMasteryByModule = deriveContiguousBloomMastery(finalGrade.results);
      const moduleIds = [...new Set(allQuestions.map((question) => question.moduleId))];
      const { setMasteredLevels } = useAppStore.getState();

      moduleIds.forEach((moduleId) => {
        const mastery = bloomMasteryByModule[moduleId] ?? 0;
        setMasteredLevels(
          moduleId,
          bloomTaxonomiesThroughLevel(mastery).map((_, index) => index + 1),
        );
        bloomMasteryByModule[moduleId] = mastery;
      });

      setPreTestCompleted(true);
      if (token) {
        try {
          const progress = await fetchLearningProgress();
          await saveLearningProgress(
            progress.completedModuleIds,
            progress.lastUnlockedModuleId,
            undefined,
            progress.theoryPassedModuleIds ?? [],
            lmsSessionId ?? undefined,
            {
              ...(progress.bloomMasteryByModule ?? {}),
              ...bloomMasteryByModule,
            },
          );
        } catch (progressError) {
          console.error('Failed to persist Bloom mastery progress:', progressError);
        }
      }
      clearPretestDraft(pretestDraftKey);
    } else {
      // Compare with the latest stored pre-test for a learning-gain summary.
      try {
        const assessments = await fetchLearningAssessments();
        const preScore = scoreStoredObjectiveAssessment(modules, assessments, 'pretest');
        const finalScore = scoreLearningAssessment(questions, answersToSubmit);
        if (preScore) setGain(computeLearningGain(preScore, finalScore));
      } catch (err) {
        console.warn('[assessment] could not load pre-test for gain comparison:', err);
      }
    }

    return finalGrade;
  };

  const handleSubmitLevel = async (): Promise<void> => {
    if (questions.length === 0) {
      setError('No questions are available for this Bloom level.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const grade = await gradeLearningAssessmentOnServer({
        assessmentType,
        answers: buildLearningAssessmentAnswerInputs(questions, answers),
      });
      const nextLevelGrades = { ...levelGrades, [currentLevel]: grade };
      setLevelGrades(nextLevelGrades);

      if (assessmentType === 'pretest' && currentLevel < BLOOM_TAXONOMIES.length) {
        setLevelSubmitted(true);
        return;
      }

      await finalizeAssessment(answers);
      setLevelSubmitted(true);
      setAssessmentComplete(true);
      if (autoAdvance) navigate(meta.nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the level results.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = (): void => {
    if (assessmentType === 'pretest' && currentLevel < BLOOM_TAXONOMIES.length) {
      setCurrentLevel((level) => level + 1);
      setLevelSubmitted(false);
      return;
    }

    if (assessmentType === 'pretest' && typeof window !== 'undefined') {
      const requestedNext = new URL(window.location.href).searchParams.get('next');
      navigate(resolvePreTestNext(requestedNext));
      return;
    }
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
              <h1 className="nt-test-page__panel-title">No objective questions are available</h1>
            </div>
            <p className="nt-test-page__panel-copy">
              The module bank needs at least one objective (multiple-choice or identification) question before this assessment can render.
            </p>
          </section>
        </div>
      </main>
    );
  }

  // Results / confirmation screen (post-assessment, non-pretest or after finalizing pretest).
  if (assessmentComplete && assessmentType !== 'pretest') {
    const finalScore = scoreLearningAssessment(questions, answers);
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-phase="post">
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">{meta.eyebrow}</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">{meta.badge}</div>
            <h1 className="nt-test-page__title">{meta.title} — Results</h1>
            <p className="nt-test-page__lede" role="status">Your answers have been submitted and saved.</p>
          </header>

          <section className="nt-test-page__panel nt-results">
            <PostTestResults score={finalScore} gain={gain} />
            <div className="nt-assessment__footer">
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate(meta.nextPath)}>
                {meta.continueLabel}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // Taking the assessment.
  return (
    <main
      className="nt-test-page"
      data-testid={`${assessmentType}-page`}
      data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}
    >
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">{meta.eyebrow}</p>
          <div className="nt-test-page__badge nt-test-page__badge--alt">{meta.badge}</div>
          <h1 className="nt-test-page__title">{meta.title}</h1>
          <p className="nt-test-page__lede">
            Answer the questions below. You can move between pages with Previous and Next, and review everything before submitting.
          </p>
        </header>

        <section className="nt-test-page__panel">
          <div className="nt-test-page__panel-head">
            <span className="nt-test-page__panel-kicker">
              {assessmentType === 'pretest'
                ? `Level ${currentLevel}: ${titleCaseTaxonomy(currentTaxonomy)} (${answeredCount}/${questions.length} answered)`
                : `${answeredCount}/${questions.length} answered`}
            </span>
            <h2 className="nt-test-page__panel-title">
              {assessmentComplete
                ? assessmentType === 'pretest' ? 'Pre-test Score Summary' : 'Assessment complete'
                : "Bloom's Taxonomy Assessment"}
            </h2>
          </div>

          <section className="nt-assessment" data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
            {assessmentType === 'pretest' ? (
              <div className="nt-assessment__stepper" aria-label="Bloom assessment progress">
                {levelProgress.map((level) => (
                  <div
                    key={level.level}
                    className="nt-assessment__step"
                    data-active={level.active}
                    data-complete={level.complete}
                    data-empty={level.total === 0}
                  >
                    <span className="nt-assessment__step-num">{level.level}</span>
                    <span className="nt-assessment__step-label">{titleCaseTaxonomy(level.taxonomy)}</span>
                    <span className="nt-assessment__step-count">
                      Answered: {level.answered}/{level.total}
                    </span>
                    {level.complete ? (
                      <span className="nt-assessment__step-score">
                        Score: {level.correct ?? 0}/{level.total}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!assessmentComplete ? (
              <ol className="nt-assessment__items">
                {questions.map((item) => (
                  <li key={`${item.moduleId}#${item.questionIndex}`}>
                    <p className="nt-assessment__module">
                      <span className="nt-assessment__band">{item.moduleEyebrow}</span> {item.moduleTitle}
                      <span className="nt-assessment__taxonomy" data-taxonomy={item.taxonomy}>
                        {titleCaseTaxonomy(item.taxonomy)}
                      </span>
                    </p>
                    <BloomQuestionRenderer
                      question={item.question}
                      userAnswer={answers[item.assessmentIndex]}
                      showResult={levelSubmitted}
                      onAnswer={(value) => {
                        if (levelSubmitted) return;
                        setError(null);
                        setAnswers((previous) => ({ ...previous, [item.assessmentIndex]: value }));
                      }}
                    />
                  </li>
                ))}
              </ol>
            ) : null}

            {levelSubmitted && levelGrade ? (
              <div className="nt-assessment__result" role="status" aria-live="polite">
                <p className="nt-assessment__score">
                  {assessmentType === 'pretest' ? titleCaseTaxonomy(currentTaxonomy) : 'Assessment'} score:{' '}
                  <strong>{levelGrade.correctCount}/{levelGrade.totalCount}</strong>
                </p>
                {assessmentType === 'pretest'
                  && !assessmentComplete
                  && currentLevel < BLOOM_TAXONOMIES.length ? (
                  <p className="nt-assessment__gain">
                    Your score is saved for this level. Continue when you are ready for{' '}
                    {titleCaseTaxonomy(BLOOM_TAXONOMIES[currentLevel])}.
                  </p>
                ) : null}
              </div>
            ) : null}

            {assessmentComplete && assessmentType === 'pretest' ? (
              <div className="nt-assessment__result nt-assessment__summary" data-testid="pretest-score-summary">
                <h3>Bloom&apos;s Taxonomy scores</h3>
                <ul>
                  {BLOOM_TAXONOMIES.map((taxonomy, index) => {
                    const grade = levelGrades[index + 1];
                    return (
                      <li key={taxonomy}>
                        <span className="nt-assessment__summary-label">{titleCaseTaxonomy(taxonomy)}</span>
                        <span>
                          Answered: {levelProgress[index]?.answered ?? 0}/{levelProgress[index]?.total ?? 0}
                        </span>
                        <strong>
                          Score: {grade?.correctCount ?? 0}/{grade?.totalCount ?? levelProgress[index]?.total ?? 0}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
                <p className="nt-assessment__gain">
                  Your learning path is ready. Modules with weaker pre-test evidence are prioritized, while fully
                  mastered modules are treated as already understood.
                </p>
              </div>
            ) : null}

            {error ? <p className="nt-assessment__hint" role="alert">{error}</p> : null}

            <div className="nt-assessment__footer">
              {!assessmentComplete && !levelSubmitted ? (
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={handleSubmitLevel}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Submit Level'}
                </button>
              ) : (
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={handleContinue}
                  disabled={saving}
                >
                  {assessmentComplete
                    ? meta.continueLabel
                    : `Proceed to Next Level`}
                </button>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
