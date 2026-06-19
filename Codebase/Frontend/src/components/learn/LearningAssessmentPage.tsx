import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import {
  fetchActivePlan,
  fetchLearningAssessments,
  saveLearningAssessment,
  refreshGuest,
} from '../../api/client';
import { useAppStore } from '../../store/appState';
import { useLearningModules } from '../../data/useLearningModules';
import {
  buildLearningAssessmentAnswerInputs,
  computeLearningGain,
  hasLearningAssessmentAnswer,
  LEARNING_ASSESSMENT_META,
  moduleProficiencyStatus,
  PROFICIENCY_THRESHOLD,
  scoreLearningAssessment,
  scoreStoredObjectiveAssessmentForCycle,
  type AssessmentScore,
  type LearningAssessmentQuestion,
  type LearningAssessmentType,
  type LearningGain,
  type ModuleScore,
} from '../../data/learningAssessments';
import {
  startPosttestForCycle,
  startPretestCycle,
  type CycleErrorCode,
  type LearningPlan,
} from '../../data/assessmentCycle';
import type { LearningAssessmentAttemptRaw } from '../../types/api';
import { BloomQuestionRenderer } from './BloomQuestionRenderer';

// Cycle state: null = still resolving; ok = ready with questions/cycleId; error
// = an explicit reject (no silent fallback).
type CycleState =
  | { status: 'loading' }
  | { status: 'ready'; cycleId: string; planId: string | null; questions: LearningAssessmentQuestion[] }
  | { status: 'error'; error: CycleErrorCode };

const CYCLE_ERROR_COPY: Record<CycleErrorCode, { kicker: string; title: string; copy: string }> = {
  NO_ACTIVE_PLAN: {
    kicker: 'No active plan',
    title: 'No active learning plan',
    copy: 'A formal assessment requires an active learning plan with approved modules. Ask your project manager to activate a plan, then return here.',
  },
  NO_APPROVED_MODULES: {
    kicker: 'No approved modules',
    title: 'Your plan has no approved modules',
    copy: 'Your active plan exists but none of its modules are approved or added. The formal pre-test only covers approved/added modules.',
  },
  INCOMPLETE_FORM_A: {
    kicker: 'Configuration',
    title: 'Pre-test content incomplete',
    copy: 'One or more approved modules do not yet have a complete pre-test form (Form A). The formal pre-test cannot start until every approved module is fully authored.',
  },
  INCOMPLETE_FORM_B: {
    kicker: 'Development only',
    title: 'Post-test not yet available',
    copy: 'One or more modules from your pre-test do not have a complete post-test form (Form B). Form A is never reused as the post-test, so the post-test stays closed until Form B is authored.',
  },
  FORM_OVERLAP: {
    kicker: 'Configuration',
    title: 'Assessment content conflict',
    copy: 'A module has overlapping pre-test and post-test questions. The forms must be distinct before the assessment can run.',
  },
  NO_PAIRED_PRETEST: {
    kicker: 'No paired pre-test',
    title: 'Complete the pre-test first',
    copy: 'There is no completed pre-test for an open assessment cycle, so a post-test cannot start. Finish the pre-test for your active plan first.',
  },
  MODULE_SET_MISMATCH: {
    kicker: 'Pairing error',
    title: 'Post-test module set mismatch',
    copy: 'The post-test could not be built for the exact module set used in your pre-test. Please contact an administrator.',
  },
};

// Pick the most recent pre-test cycle that has no paired post-test of this type
// yet — i.e. the open cycle to complete. Scope still comes from that pre-test's
// frozen module set (not "latest"); this only selects WHICH cycle to finish.
function openCycleIdForPosttest(
  assessmentType: LearningAssessmentType,
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>,
): string | null {
  const paired = new Set(
    attempts.filter((a) => a.assessmentType === assessmentType && a.cycleId).map((a) => a.cycleId),
  );
  const candidates = attempts.filter((a) => a.assessmentType === 'pretest' && a.cycleId && !paired.has(a.cycleId));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id - b.id);
  return candidates[candidates.length - 1].cycleId ?? null;
}

interface LearningAssessmentPageProps {
  assessmentType: LearningAssessmentType;
  autoAdvance?: boolean;
}

const PAGE_SIZE = 5;

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

function LearningAssessmentContent({
  assessmentType,
  autoAdvance = false,
}: LearningAssessmentPageProps): JSX.Element {
  const meta = LEARNING_ASSESSMENT_META[assessmentType];
  const { modules, loaded } = useLearningModules();
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);

  // Cycle-aware sourcing: a pre-test starts a NEW cycle from the learner's
  // active plan (Form A); a post-test pairs to its cycle's pre-test module set
  // (Form B). Resolved asynchronously (needs the active plan / prior attempts).
  const [cycle, setCycle] = useState<CycleState>({ status: 'loading' });

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    setCycle({ status: 'loading' });

    (async () => {
      try {
        if (assessmentType === 'pretest') {
          const { plan } = await fetchActivePlan();
          const planForCycle: LearningPlan | null = plan
            ? { id: plan.id, status: plan.status, modules: plan.modules }
            : null;
          const cycleId =
            typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cyc_${Date.now()}`;
          const result = startPretestCycle({ plan: planForCycle, modules, cycleId });
          if (cancelled) return;
          setCycle(result.ok
            ? { status: 'ready', cycleId: result.cycleId, planId: result.planId, questions: result.questions }
            : { status: 'error', error: result.error });
        } else {
          const assessments = await fetchLearningAssessments();
          const openCycleId = openCycleIdForPosttest(assessmentType, assessments.attempts);
          if (!openCycleId) {
            if (!cancelled) setCycle({ status: 'error', error: 'NO_PAIRED_PRETEST' });
            return;
          }
          const result = startPosttestForCycle({
            cycleId: openCycleId,
            modules,
            attempts: assessments.attempts,
            answers: assessments.answers,
          });
          if (cancelled) return;
          setCycle(result.ok
            ? { status: 'ready', cycleId: result.cycleId, planId: null, questions: result.questions }
            : { status: 'error', error: result.error });
        }
      } catch (err) {
        if (!cancelled) setCycle({ status: 'error', error: 'NO_ACTIVE_PLAN' });
      }
    })();

    return () => { cancelled = true; };
  }, [assessmentType, loaded, modules]);

  const questions = cycle.status === 'ready' ? cycle.questions : [];

  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<'taking' | 'review' | 'done'>('taking');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<AssessmentScore | null>(null);
  const [gain, setGain] = useState<LearningGain | null>(null);

  useEffect(() => {
    setAnswers({});
    setPage(0);
    setPhase('taking');
    setError(null);
    setScore(null);
    setGain(null);
  }, [assessmentType]);

  const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageQuestions = questions.slice(pageStart, pageStart + PAGE_SIZE);
  const answeredCount = questions.filter((q) => hasLearningAssessmentAnswer(q.question, answers[q.assessmentIndex])).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isLastPage = page >= totalPages - 1;

  const submit = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const finalScore = scoreLearningAssessment(questions, answers);
      const inputs = buildLearningAssessmentAnswerInputs(questions, answers);
      await saveLearningAssessment({
        assessmentType,
        sessionId: lmsSessionId,
        answers: inputs,
        cycleId: cycle.status === 'ready' ? cycle.cycleId : null,
        planId: cycle.status === 'ready' ? cycle.planId : null,
      });

      // Proactive guest session refresh on a major action (parity with prior flow).
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
      } else {
        // Learning gain is paired by CYCLE: compare against the pre-test from
        // this post-test's own cycle (not the latest pre-test). Only when a
        // cycle is known.
        try {
          const cycleId = cycle.status === 'ready' ? cycle.cycleId : null;
          if (cycleId) {
            const assessments = await fetchLearningAssessments();
            const preScore = scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'pretest', cycleId);
            if (preScore) setGain(computeLearningGain(preScore, finalScore));
          }
        } catch (err) {
          console.warn('[assessment] could not load paired pre-test for gain comparison:', err);
        }
      }

      setScore(finalScore);
      setPhase('done');
      if (autoAdvance) navigate(meta.nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the assessment.');
      setPhase('review');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || cycle.status === 'loading') {
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`}>
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Loading</span>
              <h1 className="nt-test-page__panel-title">Preparing the assessment</h1>
            </div>
            <p className="nt-test-page__panel-copy">Resolving your active learning plan and assessment forms.</p>
          </section>
        </div>
      </main>
    );
  }

  if (cycle.status === 'error') {
    const copy = CYCLE_ERROR_COPY[cycle.error];
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-cycle-error={cycle.error}>
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">{copy.kicker}</span>
              <h1 className="nt-test-page__panel-title">{copy.title}</h1>
            </div>
            <p className="nt-test-page__panel-copy">{copy.copy}</p>
            <div className="nt-assessment__footer">
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/patterns/learn')}>
                Back to Learning Path
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // Results / confirmation screen.
  if (phase === 'done' && score) {
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">{meta.eyebrow}</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">{meta.badge}</div>
            <h1 className="nt-test-page__title">{meta.title} — Results</h1>
            <p className="nt-test-page__lede" role="status">Your answers have been submitted and saved.</p>
          </header>

          <section className="nt-test-page__panel nt-results">
            {assessmentType === 'pretest'
              ? <PreTestResults score={score} />
              : <PostTestResults score={score} gain={gain} />}
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

  // Review-before-submit screen.
  if (phase === 'review') {
    return (
      <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">{meta.eyebrow}</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">{meta.badge}</div>
            <h1 className="nt-test-page__title">Review your answers</h1>
            <p className="nt-test-page__lede">
              {unansweredCount === 0
                ? 'All questions answered. Submit when you are ready.'
                : `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} still unanswered — unanswered questions are marked incorrect.`}
            </p>
          </header>

          <section className="nt-test-page__panel">
            <div className="nt-assessment__reviewgrid" aria-label="Answer review">
              {questions.map((q, i) => {
                const answered = hasLearningAssessmentAnswer(q.question, answers[q.assessmentIndex]);
                return (
                  <button
                    key={`${q.moduleId}#${q.questionIndex}`}
                    type="button"
                    className="nt-assessment__reviewcell"
                    data-answered={answered ? 'true' : 'false'}
                    onClick={() => { setPage(Math.floor(i / PAGE_SIZE)); setPhase('taking'); }}
                    title={answered ? `Question ${i + 1}: answered` : `Question ${i + 1}: not answered`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {error ? <p className="nt-assessment__hint" role="alert">{error}</p> : null}

            <div className="nt-assessment__footer">
              <button type="button" className="nt-lesson-button" onClick={() => setPhase('taking')}>
                Back to questions
              </button>
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : meta.submitLabel}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // Taking the assessment (paginated).
  return (
    <main className="nt-test-page" data-testid={`${assessmentType}-page`} data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
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
          <div className="nt-assessment__progress" aria-label="Assessment progress">
            <div className="nt-assessment__progressbar">
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="nt-assessment__progressmeta">
              <span>Page {page + 1} of {totalPages}</span>
              <span>{answeredCount} of {questions.length} answered</span>
              {unansweredCount > 0 ? <span className="nt-assessment__unanswered">{unansweredCount} unanswered</span> : null}
            </div>
          </div>

          <section className="nt-assessment" data-phase={assessmentType === 'pretest' ? 'pre' : 'post'}>
            <ol className="nt-assessment__items">
              {pageQuestions.map((item, localIdx) => {
                const number = pageStart + localIdx + 1;
                const selected = answers[item.assessmentIndex];
                const answered = hasLearningAssessmentAnswer(item.question, selected);
                return (
                  <li key={`${item.moduleId}#${item.questionIndex}`}>
                    <p className="nt-assessment__qnum">
                      Question {number} of {questions.length}
                      {!answered ? <span className="nt-assessment__qflag" aria-hidden="true"> · unanswered</span> : null}
                    </p>
                    <BloomQuestionRenderer
                      question={item.question}
                      userAnswer={selected}
                      showResult={false}
                      onAnswer={(val) => {
                        setError(null);
                        setAnswers((prev) => ({ ...prev, [item.assessmentIndex]: val }));
                      }}
                    />
                  </li>
                );
              })}
            </ol>

            <div className="nt-assessment__footer">
              <button
                type="button"
                className="nt-lesson-button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </button>
              {!isLastPage ? (
                <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                  Next
                </button>
              ) : (
                <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => setPhase('review')}>
                  Review &amp; Submit
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
  return <LearningAssessmentContent {...props} />;
}
