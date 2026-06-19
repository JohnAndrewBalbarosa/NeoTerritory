import { useCallback, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../logic/router';
import { fetchLearningAssessments, fetchLearningProgress, saveLearningAssessment, saveLearningProgress } from '../../../api/client';
import {
  CATEGORY_META,
  isFoundationModule,
  isAnswerCorrect,
  type LearningCategory,
  type LearningModule,
  type PracticalExam,
  type TheoreticalExam,
  type BloomTaxonomy,
} from '../../../data/learningModules';
import { BloomQuestionRenderer } from '../../learn/BloomQuestionRenderer';
import {
  evaluateFoundationPretestFromAssessments,
  PROFICIENCY_THRESHOLD,
  scoreStoredObjectiveAssessment,
  type FoundationPretestEvidence,
} from '../../../data/learningAssessments';
import { useLearningModules } from '../../../data/useLearningModules';
import { useAppStore } from '../../../store/appState';

interface CourseStep {
  module: LearningModule;
  category: LearningCategory;
  globalIndex: number;
}

interface CategoryGroup {
  meta: (typeof CATEGORY_META)[number];
  steps: ReadonlyArray<CourseStep>;
}

type LessonPageKind = 'lesson' | 'theoretical' | 'practical';

interface LessonPage {
  kind: LessonPageKind;
  label: string;
  subIndex?: number;
}

interface LessonPageGroup {
  key: LessonPageKind;
  label: string;
  pages: ReadonlyArray<LessonPage>;
}

type TheoryAnswerMap = Record<number, any>;

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

function clampBloomMastery(level: number | undefined): number {
  return Math.max(0, Math.min(6, Math.floor(level ?? 0)));
}

function masteryLevelFromStoredLevels(levels: ReadonlyArray<number> | undefined): number {
  return clampBloomMastery(Math.max(0, ...(levels ?? [])));
}

function bloomLevelForTaxonomy(taxonomy: BloomTaxonomy | undefined): number {
  return taxonomy ? BLOOM_LEVELS.indexOf(taxonomy) + 1 : 0;
}

function anchorId(moduleId: string, section: string, sub?: number): string {
  return `mod-${moduleId}-${section}${sub != null ? `-${sub}` : ''}`;
}

function buildCategoryGroups(
  modulesInCat: (category: LearningCategory) => ReadonlyArray<LearningModule>,
): {
  groups: ReadonlyArray<CategoryGroup>;
  steps: ReadonlyArray<CourseStep>;
} {
  const steps: CourseStep[] = [];
  const groups: CategoryGroup[] = [];

  CATEGORY_META.forEach((meta) => {
    const inCat = modulesInCat(meta.id);
    if (inCat.length === 0) return;

    const grouped = inCat.map((module) => {
      const step: CourseStep = {
        module,
        category: meta.id,
        globalIndex: steps.length,
      };
      steps.push(step);
      return step;
    });

    groups.push({ meta, steps: grouped });
  });

  return { groups, steps };
}

function computeUnlockedCount(steps: ReadonlyArray<CourseStep>, completedIds: ReadonlySet<string>): number {
  let n = 1;
  for (let i = 0; i < steps.length - 1; i += 1) {
    if (completedIds.has(steps[i].module.id)) n += 1;
    else break;
  }
  return Math.min(n, Math.max(steps.length, 1));
}

function lastUnlockedModuleIdFor(steps: ReadonlyArray<CourseStep>, completedIds: ReadonlySet<string>): string | null {
  if (steps.length === 0) return null;
  const unlockedCount = computeUnlockedCount(steps, completedIds);
  return steps[Math.max(0, Math.min(unlockedCount, steps.length) - 1)]?.module.id ?? null;
}

function readUnlockAllOverride(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('nt_learning_unlock_all') === '1';
  } catch {
    return false;
  }
}

// Indexes of theoretical-exam questions still worth showing the learner: a
// question is hidden once the learner's Bloom mastery for the module reaches
// (or passes) that question's taxonomy level.
export function visibleTheoryQuestionIndexesFor(
  module: LearningModule | undefined,
  masteryLevel = 0,
): number[] {
  if (!module?.theoreticalExam) return [];
  const indexes: number[] = [];
  module.theoreticalExam.questions.forEach((q, i) => {
    // Generated fallbacks are excluded from the in-module quiz too, but we keep
    // the ORIGINAL source index (i) — never reindexed — so saved analytics stay
    // aligned with existing learning_question_results rows.
    if (q.generatedFallback) return;
    const level = bloomLevelForTaxonomy(q.taxonomy || 'remembering');
    if (level > masteryLevel) indexes.push(i);
  });
  return indexes;
}

export function lessonPagesFor(
  module: LearningModule | undefined,
  masteryLevel = 0,
): ReadonlyArray<LessonPage> {
  if (!module) return [];

  // The whole module reads as a single scrollable lesson page (intro +
  // concepts + examples); exams remain distinct pages so they can gate
  // progress.
  const pages: LessonPage[] = [{ kind: 'lesson', label: 'Lesson' }];

  if (module.theoreticalExam && visibleTheoryQuestionIndexesFor(module, masteryLevel).length > 0) {
    pages.push({ kind: 'theoretical', label: 'Conceptual Assessment' });
  }

  if (module.practicalExam) {
    const taxonomy = module.practicalExam.taxonomy || 'creating';
    const level = bloomLevelForTaxonomy(taxonomy);
    if (level > masteryLevel) {
      pages.push({ kind: 'practical', label: 'Practical Exam' });
    }
  }

  return pages;
}

function lessonPageGroupsFor(
  module: LearningModule | undefined,
  masteryLevel = 0,
): ReadonlyArray<LessonPageGroup> {
  if (!module) return [];

  const pages = lessonPagesFor(module, masteryLevel);
  const groups: LessonPageGroup[] = [
    { key: 'lesson', label: 'Lesson', pages: pages.filter((p) => p.kind === 'lesson') },
    { key: 'theoretical', label: 'Conceptual Assessment', pages: pages.filter((p) => p.kind === 'theoretical') },
    { key: 'practical', label: 'Practical Exam', pages: pages.filter((p) => p.kind === 'practical') },
  ];

  return groups.filter((g) => g.pages.length > 0);
}

function describeExams(module: LearningModule | undefined): string {
  if (!module) return '';

  const parts: string[] = [];
  if (module.theoreticalExam) {
    parts.push(`a ${module.theoreticalExam.questions.length}-question theoretical exam`);
  }
  if (module.practicalExam) {
    parts.push(`a Studio practical exam (analyser must tag ${module.practicalExam.patternName})`);
  }
  if (parts.length === 0) return 'No exam configured - advance with the > arrow when ready.';
  if (parts.length === 1) return `Pass ${parts[0]}.`;
  return `Pass ${parts[0]} first, which unlocks ${parts[1]}.`;
}

function PrerequisiteBanner({
  steps,
  activeIndex,
  isActiveComplete,
  foundationBypassed,
}: {
  steps: ReadonlyArray<CourseStep>;
  activeIndex: number;
  isActiveComplete: boolean;
  foundationBypassed: boolean;
}): JSX.Element | null {
  const active = steps[activeIndex];
  if (!active) return null;

  const prev = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const next = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;
  const isFirst = activeIndex === 0;

  return (
    <aside className="nt-lesson-prereq" role="region" aria-label="Prerequisite check">
      <header className="nt-lesson-prereq__head">
        <p className="nt-lesson-prereq__eyebrow">Prerequisite check</p>
        <h2 className="nt-lesson-prereq__title">{active.module.title}</h2>
      </header>

      <dl className="nt-lesson-prereq__grid">
        <div className="nt-lesson-prereq__row">
          <dt>Unlock condition</dt>
          <dd>
            {isFirst
              ? 'This is the first module of the path - always unlocked.'
              : prev
                ? <>Previous module "{prev.module.title}" must be completed.</>
                : 'Always unlocked.'}
          </dd>
        </div>

        <div className="nt-lesson-prereq__row">
          <dt>To complete this module</dt>
          <dd>{describeExams(active.module)}</dd>
        </div>

        <div className="nt-lesson-prereq__row" data-state={isActiveComplete ? 'done' : 'pending'}>
          <dt>Status of this module</dt>
          <dd>
            {isActiveComplete
              ? (foundationBypassed && isFoundationModule(active.module)
                  ? 'Bypassed by pretest mastery - the Next arrow is unlocked.'
                  : 'Complete - the Next arrow is unlocked.')
              : 'Pending - step to the exam pages with > to attempt them.'}
          </dd>
        </div>

        <div className="nt-lesson-prereq__row">
          <dt>To unlock the next module</dt>
          <dd>
            {next ? <>Complete this module to unlock "{next.module.title}".</> : 'This is the final module of the path - no further unlock.'}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function LessonBody({
  module,
  steps,
  activeIndex,
  isActiveComplete,
  foundationBypassed,
}: {
  module: LearningModule;
  steps: ReadonlyArray<CourseStep>;
  activeIndex: number;
  isActiveComplete: boolean;
  foundationBypassed: boolean;
}): JSX.Element {
  const conceptSections = module.sections.filter((s) => !s.code);
  const exampleSections = module.sections.filter((s) => Boolean(s.code));

  return (
    <>
      <p className="nt-learn__module-intro nt-learn__module-intro--lead" id={anchorId(module.id, 'intro')}>
        {module.intro}
      </p>

      {conceptSections.length > 0 ? (
        <section className="nt-learn__module-group" id={anchorId(module.id, 'concepts')} aria-label="Concepts">
          <p className="nt-learn__group-eyebrow">Concepts</p>
          {conceptSections.map((s, i) => (
            <section className="nt-learn__module-section" key={`${module.id}-c-${i}`}>
              <h3 className="nt-learn__module-section-head">{s.heading}</h3>
              {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
              {s.bullets && s.bullets.length > 0 ? (
                <ul className="nt-learn__module-bullets">
                  {s.bullets.map((b, bi) => (
                    <li key={`${module.id}-c-${i}-b-${bi}`}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </section>
      ) : null}

      {exampleSections.length > 0 ? (
        <section className="nt-learn__module-group" id={anchorId(module.id, 'examples')} aria-label="Examples">
          <p className="nt-learn__group-eyebrow">Examples</p>
          {exampleSections.map((s, i) => (
            <section className="nt-learn__module-section" key={`${module.id}-e-${i}`}>
              <h3 className="nt-learn__module-section-head">{s.heading}</h3>
              {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
              {s.code ? (
                <pre className="nt-learn__module-code" aria-label="Code example">
                  {s.code}
                </pre>
              ) : null}
            </section>
          ))}
        </section>
      ) : null}

      <PrerequisiteBanner
        steps={steps}
        activeIndex={activeIndex}
        isActiveComplete={isActiveComplete}
        foundationBypassed={foundationBypassed}
      />
    </>
  );
}

function TheoreticalExamBlock({
  moduleId,
  exam,
  questionIndexes,
  answers,
  onAnswerChange,
  isPassed,
  isSubmitGate,
}: {
  moduleId: string;
  exam: TheoreticalExam;
  questionIndexes: ReadonlyArray<number>;
  answers: TheoryAnswerMap;
  onAnswerChange: (questionIndex: number, answer: any) => void;
  isPassed: boolean;
  isSubmitGate: boolean;
}): JSX.Element | null {
  if (questionIndexes.length === 0) return null;

  return (
    <section className="nt-learn__module-group" id={anchorId(moduleId, 'theoretical')} aria-label="Conceptual assessment">
      {questionIndexes.map((qi, pos) => {
        const q = exam.questions[qi];
        if (!q) return null;
        // The prompt is rendered ONCE, by BloomQuestionRenderer below. The outer
        // heading carries only the (sequential) question number. The positional
        // sourceQuestionIndex (qi) still keys answers/scoring/analytics — only the
        // displayed label is sequential.
        return (
          <section className="nt-exam__question" key={`${moduleId}-q-${qi}`} aria-label={`Question ${pos + 1}`}>
            <p className="nt-exam__qnum">Question {pos + 1}</p>
            <BloomQuestionRenderer
              question={q}
              userAnswer={answers[qi]}
              showResult={isPassed}
              onAnswer={(answer) => onAnswerChange(qi, answer)}
            />
          </section>
        );
      })}
      {isPassed ? (
        <p className="nt-exam__status nt-exam__status--pass">
          {isSubmitGate
            ? 'All answers are correct. The Next arrow can submit this module.'
            : 'Theory passed. The Next arrow opens the practical exam.'}
        </p>
      ) : (
        <p className="nt-exam__status">Answer every question correctly before the module unlocks.</p>
      )}
    </section>
  );
}

function PracticalExamBlock({
  moduleId,
  exam,
  isPassed,
  answer,
  saving,
  onAnswerChange,
  onSave,
}: {
  moduleId: string;
  exam: PracticalExam;
  isPassed: boolean;
  answer: string;
  saving: boolean;
  onAnswerChange: (next: string) => void;
  onSave: () => void;
}): JSX.Element {
  return (
    <section className="nt-practical nt-practical--studio" id={anchorId(moduleId, 'practical')} aria-label="Practical exam">
      <header className="nt-practical__head">
        <p className="nt-practical__eyebrow">Practical Exam</p>
        <h3 className="nt-practical__title">
          Target pattern: <span className="nt-practical__target">{exam.patternName}</span>
        </h3>
        <p className="nt-practical__prompt">{exam.prompt}</p>
      </header>
      {!isPassed ? (
        <div className="nt-practical__composer">
          <textarea
            className="nt-practical__editor"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Paste the practical answer or Studio code output here..."
            rows={10}
          />
          <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Practical Answer'}
          </button>
        </div>
      ) : (
        <p className="nt-practical__verdict nt-practical__verdict--pass">Verified.</p>
      )}
    </section>
  );
}

export default function PatternsLearnPage(): JSX.Element {
  const token = useAppStore((s) => s.token);
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const masteredLevelsByModule = useAppStore((s) => s.masteredLevelsByModule);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const unlockAll = useMemo(() => readUnlockAllOverride(), []);
  const { findModule, modulesInCategory: modulesInCat, loaded: contentLoaded } = useLearningModules();
  const setLearningProgressSummary = useAppStore((s) => s.setLearningProgressSummary);
  const { groups: allGroups, steps: allSteps } = useMemo(() => buildCategoryGroups(modulesInCat), [contentLoaded, modulesInCat]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [openCategory, setOpenCategory] = useState<LearningCategory | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [theoryPassedIds, setTheoryPassedIds] = useState<Set<string>>(new Set());
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, TheoryAnswerMap>>({});
  const [practicalAnswers, setPracticalAnswers] = useState<Record<string, string>>({});
  const [practicalSaving, setPracticalSaving] = useState<Record<string, boolean>>({});
  const [practicalDone, setPracticalDone] = useState<Set<string>>(new Set());
  // Pre-test PROFICIENCY (>= 80% per module). Proficiency is NOT completion:
  // proficient modules are non-blocking and shown as "Optional Review", never
  // auto-completed or hidden. The pre-test no longer marks any module complete.
  const [proficientModuleIds, setProficientModuleIds] = useState<Set<string>>(new Set());
  const [bloomMasteryByModule, setBloomMasteryByModule] = useState<Record<string, number>>({});
  const effectiveBloomMasteryByModule = useMemo(() => {
    const next: Record<string, number> = {};
    for (const [moduleId, level] of Object.entries(bloomMasteryByModule)) {
      next[moduleId] = Math.max(next[moduleId] ?? 0, clampBloomMastery(level));
    }
    for (const [moduleId, levels] of Object.entries(masteredLevelsByModule)) {
      next[moduleId] = Math.max(next[moduleId] ?? 0, masteryLevelFromStoredLevels(levels));
    }
    return next;
  }, [bloomMasteryByModule, masteredLevelsByModule]);
  // Only genuinely-completed modules (and mastery from completion) are hidden;
  // proficient pre-test modules stay visible for optional review.
  const hiddenModuleIds = useMemo(() => {
    const hidden = new Set(completedIds);
    Object.entries(effectiveBloomMasteryByModule).forEach(([moduleId, level]) => {
      if (level >= 6) hidden.add(moduleId);
    });
    return hidden;
  }, [completedIds, effectiveBloomMasteryByModule]);
  const visibleModulesInCategory = useCallback(
    (category: LearningCategory) => modulesInCat(category).filter((module) => !hiddenModuleIds.has(module.id)),
    [hiddenModuleIds, modulesInCat],
  );
  const { steps } = useMemo(() => buildCategoryGroups(visibleModulesInCategory), [visibleModulesInCategory]);
  const [foundationEvidence, setFoundationEvidence] = useState<FoundationPretestEvidence>({
    passed: false,
    masteredTaxonomies: [],
    missingTaxonomies: ['remembering', 'understanding', 'applying'],
    correctCount: 0,
    totalCount: 0,
    latestAttemptId: null,
    matchedModuleIds: [],
  });
  const [assessmentStatus, setAssessmentStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const effectivePreTestCompleted = preTestCompleted || unlockAll || foundationEvidence.passed;

  const activeStep = steps[activeIndex];
  const activeModule = useMemo(
    () => (activeStep ? findModule(activeStep.module.id) : undefined),
    [activeStep, findModule],
  );

  const activeModuleMasteryLevel = useMemo(() => {
    if (!activeModule) return 0;
    return effectiveBloomMasteryByModule[activeModule.id] ?? 0;
  }, [activeModule, effectiveBloomMasteryByModule]);

  const pages = useMemo(
    () => lessonPagesFor(activeModule, activeModuleMasteryLevel),
    [activeModule, activeModuleMasteryLevel],
  );
  const pageGroups = useMemo(
    () => lessonPageGroupsFor(activeModule, activeModuleMasteryLevel),
    [activeModule, activeModuleMasteryLevel],
  );
  const currentPage = pages[pageIndex] || pages[0];
  // Completion = genuinely finished modules only (pre-test proficiency never
  // counts as completion). unlockAll is the dev/test override.
  const effectiveCompletedIds = useMemo(
    () => {
      if (unlockAll) return new Set(allSteps.map((step) => step.module.id));
      return new Set(completedIds);
    },
    [unlockAll, allSteps, completedIds],
  );
  const isActiveComplete = !!(activeStep && effectiveCompletedIds.has(activeStep.module.id));
  // Unlock gating treats proficient modules as non-blocking: a later required
  // module unlocks even if the learner only tested proficient (not completed)
  // on the modules before it.
  const gatingSatisfiedIds = useMemo(() => {
    if (unlockAll) return effectiveCompletedIds;
    const ids = new Set(effectiveCompletedIds);
    proficientModuleIds.forEach((id) => ids.add(id));
    return ids;
  }, [unlockAll, effectiveCompletedIds, proficientModuleIds]);
  const unlockedCount = useMemo(
    () => (unlockAll ? Math.max(steps.length, 1) : computeUnlockedCount(steps, gatingSatisfiedIds)),
    [unlockAll, steps, gatingSatisfiedIds],
  );
  const currentGroup = useMemo(
    () => pageGroups.find((group) => group.key === currentPage?.kind) ?? pageGroups[0] ?? null,
    [currentPage, pageGroups],
  );
  const visibleTheoryQuestionIndexes = useMemo(
    () => visibleTheoryQuestionIndexesFor(activeModule, activeModuleMasteryLevel),
    [activeModule, activeModuleMasteryLevel],
  );
  const visibleTheoryQuestionCount = visibleTheoryQuestionIndexes.length;
  const hasVisiblePracticalPage = pages.some((page) => page.kind === 'practical');
  const currentTheoryAnswers = activeModule ? theoryAnswers[activeModule.id] ?? {} : {};
  const isTheoryPassed = !!(
    unlockAll ||
    (activeModule && theoryPassedIds.has(activeModule.id)) ||
    (
      activeModule?.theoreticalExam &&
      (
        visibleTheoryQuestionIndexes.length === 0 ||
        visibleTheoryQuestionIndexes.every((questionIndex) => {
          const question = activeModule.theoreticalExam?.questions[questionIndex];
          return !!question && isAnswerCorrect(question, currentTheoryAnswers[questionIndex]);
        })
      )
    )
  );
  const isFinalTheoryPage =
    currentPage?.kind === 'theoretical' && visibleTheoryQuestionCount > 0;
  const isTheoryGatePage = isFinalTheoryPage;
  const isSubmitGate = isFinalTheoryPage && !hasVisiblePracticalPage;
  const isPracticalDone = !!(activeModule && practicalDone.has(activeModule.id));

  useEffect(() => {
    let cancelled = false;
    if (!token) return;

    if (!contentLoaded) {
      setAssessmentStatus('loading');
      return () => {
        cancelled = true;
      };
    }

    setAssessmentStatus('loading');
    fetchLearningAssessments()
      .then((assessments) => {
        if (cancelled) return;
        const modules = allSteps.map((step) => step.module);
        const evidence = evaluateFoundationPretestFromAssessments(modules, assessments);
        setFoundationEvidence(evidence);
        // Per-module pre-test proficiency (>= 80%) — drives Optional Review
        // labelling and non-blocking unlock, not completion.
        const preScore = scoreStoredObjectiveAssessment(modules, assessments, 'pretest');
        const proficient = new Set<string>();
        if (preScore) {
          for (const moduleScore of Object.values(preScore.byModule)) {
            if (moduleScore.percent >= PROFICIENCY_THRESHOLD) proficient.add(moduleScore.moduleId);
          }
        }
        setProficientModuleIds(proficient);
        if (evidence.passed && !preTestCompleted) {
          setPreTestCompleted(true);
        }
        setAssessmentStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setFoundationEvidence({
          passed: false,
          masteredTaxonomies: [],
          missingTaxonomies: ['remembering', 'understanding', 'applying'],
          correctCount: 0,
          totalCount: 0,
          latestAttemptId: null,
          matchedModuleIds: [],
        });
        setProficientModuleIds(new Set());
        setAssessmentStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [allSteps, contentLoaded, preTestCompleted, setPreTestCompleted, token]);

  useEffect(() => {
    if (!token || !contentLoaded || unlockAll) return;
    let cancelled = false;

    fetchLearningProgress()
      .then((progress) => {
        if (cancelled) return;
        setCompletedIds(new Set(progress.completedModuleIds));
        setTheoryPassedIds(new Set(progress.theoryPassedModuleIds ?? []));
        setBloomMasteryByModule(progress.bloomMasteryByModule ?? {});
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load learning progress:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contentLoaded, token, unlockAll]);

  useEffect(() => {
    if (unlockAll && allSteps.length > 0) {
      const moduleIds = allSteps.map((step) => step.module.id);
      setCompletedIds(new Set(moduleIds));
      setTheoryPassedIds(new Set(moduleIds));
      setBloomMasteryByModule(Object.fromEntries(moduleIds.map((moduleId) => [moduleId, 6])));
    }
  }, [allSteps, unlockAll]);

  const persistLearningProgress = useCallback(
    (
      nextCompletedIds: Set<string>,
      nextTheoryPassedIds: Set<string>,
      nextBloomMasteryByModule: Record<string, number> = effectiveBloomMasteryByModule,
    ) => {
      if (!token || unlockAll) return;
      const lastUnlockedModuleId = lastUnlockedModuleIdFor(allSteps, nextCompletedIds);
      saveLearningProgress(
        Array.from(nextCompletedIds),
        lastUnlockedModuleId,
        undefined,
        Array.from(nextTheoryPassedIds),
        lmsSessionId ?? undefined,
        nextBloomMasteryByModule,
      ).catch((err) => {
        console.error('Failed to save learning progress:', err);
      });
    },
    [allSteps, effectiveBloomMasteryByModule, lmsSessionId, token, unlockAll],
  );

  useEffect(() => {
    if (activeIndex >= steps.length && steps.length > 0) {
      setActiveIndex(steps.length - 1);
      setPageIndex(0);
    }
  }, [activeIndex, steps.length]);

  // Keep the sidebar accordion opened on whichever category the learner is
  // currently working in. Manual toggles within that category still stick;
  // this only re-opens when they move to a module in a different category.
  useEffect(() => {
    if (activeStep) setOpenCategory(activeStep.category);
  }, [activeStep?.category]);

  useEffect(() => {
    if (!effectivePreTestCompleted && assessmentStatus !== 'loading') navigate('/pre-test');
  }, [assessmentStatus, effectivePreTestCompleted]);

  const goToStep = useCallback(
    (index: number, nextPageIndex = 0) => {
      if (index >= 0 && index < steps.length) {
        setActiveIndex(index);
        setPageIndex(nextPageIndex);
      }
    },
    [steps],
  );

  const goNextPage = () => {
    const isLastPage = pageIndex >= pages.length - 1;

    if (
      activeModule &&
      isLastPage &&
      !isActiveComplete &&
      visibleTheoryQuestionCount === 0 &&
      !hasVisiblePracticalPage
    ) {
      const nextCompletedIds = new Set(completedIds).add(activeModule.id);
      const nextTheoryPassedIds = new Set(theoryPassedIds).add(activeModule.id);
      const nextBloomMasteryByModule = { ...effectiveBloomMasteryByModule, [activeModule.id]: 6 };
      setTheoryPassedIds(nextTheoryPassedIds);
      setCompletedIds(nextCompletedIds);
      setBloomMasteryByModule(nextBloomMasteryByModule);
      setPageIndex(0);
      persistLearningProgress(nextCompletedIds, nextTheoryPassedIds, nextBloomMasteryByModule);
      return;
    }

    if (isTheoryGatePage && activeModule) {
      if (!isTheoryPassed) {
        alert('Answer every question correctly before continuing this module.');
        return;
      }

      const nextTheoryPassedIds = new Set(theoryPassedIds).add(activeModule.id);
      if (!theoryPassedIds.has(activeModule.id)) {
        setTheoryPassedIds(nextTheoryPassedIds);
      }

      if (!hasVisiblePracticalPage) {
        const nextCompletedIds = new Set(completedIds).add(activeModule.id);
        const nextBloomMasteryByModule = { ...effectiveBloomMasteryByModule, [activeModule.id]: 6 };
        setCompletedIds(nextCompletedIds);
        setBloomMasteryByModule(nextBloomMasteryByModule);
        setPageIndex(0);
        persistLearningProgress(nextCompletedIds, nextTheoryPassedIds, nextBloomMasteryByModule);
        return;
      }

      persistLearningProgress(completedIds, nextTheoryPassedIds);
    }

    if (unlockAll && activeIndex === steps.length - 1 && isLastPage) {
      navigate('/student-dashboard');
      return;
    }

    if (!isLastPage) {
      setPageIndex(pageIndex + 1);
      return;
    }

    const canAdvanceToNextModule =
      unlockAll ||
      isActiveComplete ||
      (isSubmitGate && isTheoryPassed) ||
      (!!activeModule && proficientModuleIds.has(activeModule.id)); // proficient = optional, non-blocking

    if (activeIndex < steps.length - 1 && canAdvanceToNextModule) {
      goToStep(activeIndex + 1);
      return;
    }

    if (activeIndex < steps.length - 1) {
      alert('Complete exams to unlock next module.');
    }
  };

  const goPrevPage = () => {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
    else if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      const prevModule = steps[prevIdx].module;
      const prevMasteryLevel = effectiveBloomMasteryByModule[prevModule.id] ?? 0;
      setPageIndex(lessonPagesFor(prevModule, prevMasteryLevel).length - 1);
    }
  };

  // Studied-only progress for the top-bar progress bar: modules the learner
  // tested proficient on (Optional Review) are excluded from both the
  // numerator and the denominator, so the bar reflects work actually done.
  const studiedModules = useMemo(
    () => allSteps.filter((step) => !proficientModuleIds.has(step.module.id)),
    [allSteps, proficientModuleIds],
  );
  const studiedTotal = studiedModules.length;
  const studiedDone = useMemo(
    () => studiedModules.filter((step) => completedIds.has(step.module.id)).length,
    [studiedModules, completedIds],
  );

  useEffect(() => {
    setLearningProgressSummary({ done: studiedDone, total: studiedTotal });
  }, [studiedDone, studiedTotal, setLearningProgressSummary]);
  useEffect(() => () => setLearningProgressSummary(null), [setLearningProgressSummary]);

  if (!effectivePreTestCompleted && assessmentStatus === 'loading') {
    return (
      <main className="nt-test-page" data-testid="learn-gate-page">
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">Learning gate</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">PRE</div>
            <h1 className="nt-test-page__title">Checking baseline mastery</h1>
            <p className="nt-test-page__lede">
              Reading saved assessment history before deciding whether the foundations stay open.
            </p>
          </header>
        </div>
      </main>
    );
  }

  if (!effectivePreTestCompleted) {
    return (
      <main className="nt-test-page" data-testid="learn-gate-page">
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">Learning gate</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">PRE</div>
            <h1 className="nt-test-page__title">Pre-test required</h1>
            <p className="nt-test-page__lede">
              Complete the baseline check first. The app will route you to the pre-test now, then bring
              you back here after it is marked complete.
            </p>
          </header>

          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Next step</span>
              <h2 className="nt-test-page__panel-title">Opening the baseline assessment</h2>
            </div>
            <p className="nt-test-page__panel-copy">
              If the redirect is blocked, use the button below to open the pre-test manually.
            </p>
            <button type="button" className="nt-lesson-button nt-lesson-button--primary nt-test-page__cta" onClick={() => navigate('/pre-test')}>
              Open Pre-test
            </button>
            {assessmentStatus === 'failed' ? (
              <p className="nt-test-page__panel-copy">
                Saved assessment history could not be read, so the page is falling back to the local pre-test flag.
              </p>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  if (contentLoaded && steps.length === 0) {
    return (
      <main className="nt-test-page" data-testid="learn-complete-page">
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">Learning path</p>
            <div className="nt-test-page__badge nt-test-page__badge--alt">DONE</div>
            <h1 className="nt-test-page__title">No modules left to learn</h1>
            <p className="nt-test-page__lede">
              Completed and pre-test-exempt modules are hidden for this learner.
            </p>
          </header>

          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Personalized path</span>
              <h2 className="nt-test-page__panel-title">Everything visible is already complete</h2>
            </div>
            <button type="button" className="nt-lesson-button nt-lesson-button--primary nt-test-page__cta" onClick={() => navigate('/student-dashboard')}>
              Open dashboard
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (!contentLoaded || !activeModule) return <div>Loading...</div>;

  return (
    <main className="nt-student nt-student-course">
      <section className="nt-course-shell" aria-label="Learning path">
        <aside className="nt-course-sidebar" aria-label="Learning module outline" data-lenis-prevent>
          <div className="nt-course-sidebar__head">
            <p>Modules</p>
            <span>{studiedDone} / {studiedTotal} done</span>
          </div>
          <ul className="nt-course-accordion">
            {allGroups.map((g) => {
              const open = openCategory === g.meta.id;
              const clearedInCat = g.steps.filter(
                (s) => steps.findIndex((v) => v.module.id === s.module.id) === -1,
              ).length;
              return (
                <li
                  key={g.meta.id}
                  className="nt-course-accordion__group"
                  data-open={open ? 'true' : undefined}
                >
                  <button
                    type="button"
                    className="nt-course-accordion__cat"
                    aria-expanded={open}
                    onClick={() => setOpenCategory(open ? null : g.meta.id)}
                  >
                    <span className="nt-course-accordion__chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
                    <span className="nt-course-accordion__cat-name">{g.meta.name}</span>
                    <span className="nt-course-accordion__cat-count">{clearedInCat}/{g.steps.length}</span>
                  </button>
                  {open ? (
                    <ul className="nt-course-accordion__modules">
                      {g.steps.map((s, i) => {
                        const visIdx = steps.findIndex((v) => v.module.id === s.module.id);
                        const done = visIdx === -1;
                        const active = !done && visIdx === activeIndex;
                        const proficient = !done && !active && proficientModuleIds.has(s.module.id);
                        const locked = !done && !proficient && visIdx >= unlockedCount;
                        const status = done
                          ? 'done'
                          : active
                            ? 'current'
                            : proficient
                              ? 'optional'
                              : locked
                                ? 'locked'
                                : 'available';
                        return (
                          <li key={s.module.id}>
                            <button
                              type="button"
                              className="nt-course-accordion__module"
                              data-status={status}
                              aria-current={active ? 'step' : undefined}
                              disabled={done || locked}
                              title={
                                locked
                                  ? 'Finish the previous module to unlock this one.'
                                  : done
                                    ? 'Completed'
                                    : proficient
                                      ? 'Optional Review — you tested proficient on the pre-test (not required).'
                                      : undefined
                              }
                              onClick={() => { if (!done && !locked) goToStep(visIdx); }}
                            >
                              <span className="nt-course-accordion__status" aria-hidden="true">
                                {done ? '✓' : locked ? '🔒' : active ? '●' : proficient ? '◇' : '○'}
                              </span>
                              <span className="nt-course-accordion__num" aria-hidden="true">{i + 1}</span>
                              <span className="nt-course-accordion__module-label">{s.module.title}</span>
                              {proficient ? <span className="nt-course-accordion__opt">Optional</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>

        <article className="nt-lesson-panel nt-lesson-pager">
          {activeModule && currentPage ? (
            <>
              <header className="nt-pager__head">
                <div className="nt-pager__head-main">
                  <p className="nt-pager__eyebrow">
                    {activeStep?.category} / Module {activeIndex + 1} of {steps.length}
                  </p>
                  <h2 className="nt-pager__module-title">{activeModule.title}</h2>
                </div>
                {currentGroup ? (
                  <p className="nt-pager__section-meta">
                    <span>{currentGroup.label}</span>
                  </p>
                ) : null}
              </header>

              <div className={`nt-pager__stage${currentPage.kind === 'practical' ? ' nt-pager__stage--practical' : ''}`}>
                <button
                  type="button"
                  className="nt-pager__arrow nt-pager__arrow--prev"
                  onClick={goPrevPage}
                  disabled={pageIndex === 0 && activeIndex === 0}
                  aria-label="Previous"
                >
                  &lt;
                </button>

                <section className="nt-pager__page" data-kind={currentPage.kind} data-lenis-prevent aria-label={currentPage.label}>
                  {currentPage.kind === 'lesson' ? (
                    <LessonBody
                      module={activeModule}
                      steps={steps}
                      activeIndex={activeIndex}
                      isActiveComplete={isActiveComplete}
                      foundationBypassed={foundationEvidence.passed}
                    />
                  ) : null}
                  {currentPage.kind === 'theoretical' && activeModule.theoreticalExam ? (
                    <TheoreticalExamBlock
                      moduleId={activeModule.id}
                      exam={activeModule.theoreticalExam}
                      questionIndexes={visibleTheoryQuestionIndexes}
                      answers={currentTheoryAnswers}
                      onAnswerChange={(questionIndex, optionIndex) => {
                        setTheoryAnswers((prev) => ({
                          ...prev,
                          [activeModule.id]: {
                            ...(prev[activeModule.id] ?? {}),
                            [questionIndex]: optionIndex,
                          },
                        }));
                      }}
                      isPassed={isTheoryPassed}
                      isSubmitGate={isSubmitGate}
                    />
                  ) : null}
                  {currentPage.kind === 'practical' && activeModule.practicalExam ? (
                    <PracticalExamBlock
                      moduleId={activeModule.id}
                      exam={activeModule.practicalExam}
                      isPassed={isActiveComplete || isPracticalDone}
                      answer={practicalAnswers[activeModule.id] || ''}
                      saving={!!practicalSaving[activeModule.id]}
                      onAnswerChange={(next) => setPracticalAnswers((prev) => ({ ...prev, [activeModule.id]: next }))}
                      onSave={async () => {
                        const answerText = (practicalAnswers[activeModule.id] || '').trim();
                        const practicalExam = activeModule.practicalExam;
                        if (!practicalExam) return;
                        if (!answerText) {
                          alert('Paste the practical answer or code output before saving.');
                          return;
                        }
                        setPracticalSaving((prev) => ({ ...prev, [activeModule.id]: true }));
                        try {
                          await saveLearningAssessment({
                            assessmentType: 'practical',
                            sessionId: lmsSessionId,
                            answers: [{
                              moduleId: activeModule.id,
                              questionIndex: 0,
                              selectedIndex: -1,
                              responseText: answerText,
                              questionTaxonomy: practicalExam.taxonomy || 'applying',
                              questionKind: 'practical',
                            }],
                          });
                          const nextTheoryPassedIds = new Set(theoryPassedIds).add(activeModule.id);
                          const nextCompletedIds = new Set(completedIds).add(activeModule.id);
                          const nextBloomMasteryByModule = { ...effectiveBloomMasteryByModule, [activeModule.id]: 6 };
                          setTheoryPassedIds(nextTheoryPassedIds);
                          setPracticalDone((prev) => new Set(prev).add(activeModule.id));
                          setCompletedIds(nextCompletedIds);
                          setBloomMasteryByModule(nextBloomMasteryByModule);
                          setPageIndex(0);
                          persistLearningProgress(nextCompletedIds, nextTheoryPassedIds, nextBloomMasteryByModule);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Could not save practical answer.');
                        } finally {
                          setPracticalSaving((prev) => ({ ...prev, [activeModule.id]: false }));
                        }
                      }}
                    />
                  ) : null}
                </section>

                <button
                  type="button"
                  className="nt-pager__arrow nt-pager__arrow--next"
                  onClick={goNextPage}
                  disabled={pageIndex === pages.length - 1 && activeIndex === steps.length - 1}
                  data-submit={isSubmitGate ? 'true' : undefined}
                  aria-label={isSubmitGate ? 'Submit exam and continue' : 'Next'}
                >
                  &gt;
                </button>
              </div>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}

