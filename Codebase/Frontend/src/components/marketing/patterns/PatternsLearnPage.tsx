import { useCallback, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../logic/router';
import { fetchLearningAssessments, fetchLearningProgress, saveLearningAssessment, saveLearningProgress } from '../../../api/client';
import {
  CATEGORY_META,
  isFoundationModule,
  isAnswerCorrect,
  isMcqQuestion,
  type LearningCategory,
  type LearningModule,
  type PracticalExam,
  type TheoreticalExam,
  type BloomTaxonomy,
} from '../../../data/learningModules';
import {
  evaluateFoundationPretestFromAssessments,
  type FoundationPretestEvidence,
} from '../../../data/learningAssessments';
import { useLearningModules } from '../../../data/useLearningModules';
import { useAppStore } from '../../../store/appState';
import { derivePretestModuleOutcomes, type PretestModuleOutcomes } from '../../../logic/pretestModuleOutcomes';

interface CourseStep {
  module: LearningModule;
  category: LearningCategory;
  globalIndex: number;
}

interface CategoryGroup {
  meta: (typeof CATEGORY_META)[number];
  steps: ReadonlyArray<CourseStep>;
}

type LessonPageKind = 'intro' | 'concepts' | 'examples' | 'theoretical' | 'practical';

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

type LearnNavView =
  | { level: 'sections' }
  | { level: 'modules'; sectionId: LearningCategory }
  | { level: 'subsections'; sectionId: LearningCategory; moduleId: string }
  | { level: 'pages'; sectionId: LearningCategory; moduleId: string; groupKey: LessonPageKind };

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

const EMPTY_PRETEST_OUTCOMES: PretestModuleOutcomes = {
  latestAttemptId: null,
  masteredBloomLevelsByModuleId: {},
  failedModuleIds: [],
  exemptModuleIds: [],
  perfectModuleIds: [],
};

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

function lessonPagesFor(
  module: LearningModule | undefined,
  masteredLevels: number[] = [],
): ReadonlyArray<LessonPage> {
  if (!module) return [];

  const pages: LessonPage[] = [{ kind: 'intro', label: 'Introduction' }];

  const conceptSections = module.sections.filter((s) => !s.code);
  conceptSections.forEach((s, i) => {
    pages.push({ kind: 'concepts', label: s.heading || `Concept ${i + 1}`, subIndex: i });
  });

  const exampleSections = module.sections.filter((s) => Boolean(s.code));
  exampleSections.forEach((s, i) => {
    pages.push({ kind: 'examples', label: s.heading || `Example ${i + 1}`, subIndex: i });
  });

  if (module.theoreticalExam) {
    module.theoreticalExam.questions.forEach((q, i) => {
      const taxonomy = q.taxonomy || 'remembering';
      const level = bloomLevelForTaxonomy(taxonomy);
      if (!masteredLevels.includes(level)) {
        pages.push({ kind: 'theoretical', label: `Quiz Q${i + 1}`, subIndex: i });
      }
    });
  }

  if (module.practicalExam) {
    const taxonomy = module.practicalExam.taxonomy || 'creating';
    const level = bloomLevelForTaxonomy(taxonomy);
    if (!masteredLevels.includes(level)) {
      pages.push({ kind: 'practical', label: 'Practical Exam' });
    }
  }

  return pages;
}

function lessonPageGroupsFor(
  module: LearningModule | undefined,
  masteredLevels: number[] = [],
): ReadonlyArray<LessonPageGroup> {
  if (!module) return [];

  const pages = lessonPagesFor(module, masteredLevels);
  const groups: LessonPageGroup[] = [
    { key: 'intro', label: 'Intro', pages: pages.filter((p) => p.kind === 'intro') },
    { key: 'concepts', label: 'Concepts', pages: pages.filter((p) => p.kind === 'concepts') },
    { key: 'examples', label: 'Examples', pages: pages.filter((p) => p.kind === 'examples') },
    { key: 'theoretical', label: 'Theoretical Exam', pages: pages.filter((p) => p.kind === 'theoretical') },
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

function IntroBody({ module }: { module: LearningModule }): JSX.Element {
  return (
    <p className="nt-learn__module-intro nt-learn__module-intro--lead" id={anchorId(module.id, 'intro')}>
      {module.intro}
    </p>
  );
}

function ConceptsBody({ module, subIndex }: { module: LearningModule; subIndex?: number }): JSX.Element | null {
  const sections = module.sections.filter((s) => !s.code);
  const s = subIndex != null ? sections[subIndex] : null;
  if (!s) return null;

  return (
    <section className="nt-learn__module-group" id={anchorId(module.id, 'concepts', subIndex)} aria-label="Concepts">
      <p className="nt-learn__group-eyebrow">Concepts</p>
      <section className="nt-learn__module-section">
        <h3 className="nt-learn__module-section-head">{s.heading}</h3>
        {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
        {s.bullets && s.bullets.length > 0 ? (
          <ul className="nt-learn__module-bullets">
            {s.bullets.map((b, i) => (
              <li key={`${module.id}-c-${subIndex}-b-${i}`}>{b}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}

function ExamplesBody({ module, subIndex }: { module: LearningModule; subIndex?: number }): JSX.Element | null {
  const sections = module.sections.filter((s) => Boolean(s.code));
  const s = subIndex != null ? sections[subIndex] : null;
  if (!s) return null;

  return (
    <section className="nt-learn__module-group" id={anchorId(module.id, 'examples', subIndex)} aria-label="Examples">
      <p className="nt-learn__group-eyebrow">Examples</p>
      <section className="nt-learn__module-section">
        <h3 className="nt-learn__module-section-head">{s.heading}</h3>
        {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
        {s.code ? (
          <pre className="nt-learn__module-code" aria-label="Code example">
            {s.code}
          </pre>
        ) : null}
      </section>
    </section>
  );
}

function TheoreticalExamBlock({
  moduleId,
  exam,
  subIndex,
  answers,
  onAnswerChange,
  isPassed,
  isSubmitGate,
}: {
  moduleId: string;
  exam: TheoreticalExam;
  subIndex?: number;
  answers: TheoryAnswerMap;
  onAnswerChange: (questionIndex: number, optionIndex: number) => void;
  isPassed: boolean;
  isSubmitGate: boolean;
}): JSX.Element | null {
  const qi = subIndex ?? 0;
  const q = exam.questions[qi];
  if (!q || !isMcqQuestion(q)) return null;

  return (
    <section className="nt-exam__question" id={anchorId(moduleId, 'theoretical', subIndex)}>
      <p className="nt-exam__prompt">
        <span className="nt-exam__qnum">Q{qi + 1}</span>
        {q.question}
        {q.taxonomy ? (
          <span className="nt-assessment__taxonomy" data-taxonomy={q.taxonomy}>
            {q.taxonomy}
          </span>
        ) : null}
      </p>

      <ol className="nt-exam__questions">
        {q.options.map((opt, i) => (
          <li key={i}>
            <label className="nt-practical__choice" data-picked={answers[qi] === i ? 'true' : undefined}>
              <input
                type="radio"
                name={`q-${qi}`}
                checked={answers[qi] === i}
                onChange={() => onAnswerChange(qi, i)}
              />
              <span>{opt}</span>
            </label>
          </li>
        ))}
      </ol>
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
  const { steps: allSteps } = useMemo(() => buildCategoryGroups(modulesInCat), [contentLoaded, modulesInCat]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [nav, setNav] = useState<LearnNavView>({ level: 'sections' });
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [theoryPassedIds, setTheoryPassedIds] = useState<Set<string>>(new Set());
  const [seededLeafView, setSeededLeafView] = useState(false);
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, TheoryAnswerMap>>({});
  const [practicalAnswers, setPracticalAnswers] = useState<Record<string, string>>({});
  const [practicalSaving, setPracticalSaving] = useState<Record<string, boolean>>({});
  const [practicalDone, setPracticalDone] = useState<Set<string>>(new Set());
  const [pretestModuleOutcomes, setPretestModuleOutcomes] = useState<PretestModuleOutcomes>(EMPTY_PRETEST_OUTCOMES);
  const hiddenModuleIds = useMemo(() => {
    const hidden = new Set(completedIds);
    pretestModuleOutcomes.exemptModuleIds.forEach((moduleId) => hidden.add(moduleId));
    return hidden;
  }, [completedIds, pretestModuleOutcomes.exemptModuleIds]);
  const visibleModulesInCategory = useCallback(
    (category: LearningCategory) => modulesInCat(category).filter((module) => !hiddenModuleIds.has(module.id)),
    [hiddenModuleIds, modulesInCat],
  );
  const { groups, steps } = useMemo(() => buildCategoryGroups(visibleModulesInCategory), [visibleModulesInCategory]);
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
  const foundationModuleIds = useMemo(
    () => allSteps.filter((step) => isFoundationModule(step.module)).map((step) => step.module.id),
    [allSteps],
  );
  const effectivePreTestCompleted = preTestCompleted || unlockAll || foundationEvidence.passed;

  const activeStep = steps[activeIndex];
  const activeModule = useMemo(
    () => (activeStep ? findModule(activeStep.module.id) : undefined),
    [activeStep, findModule],
  );

  const activeModuleMasteredLevels = useMemo(
    () => {
      if (!activeModule) return [];
      const localLevels = masteredLevelsByModule[activeModule.id] || [];
      const pretestLevels = (pretestModuleOutcomes.masteredBloomLevelsByModuleId[activeModule.id] || [])
        .map(bloomLevelForTaxonomy)
        .filter((level) => level > 0);
      return Array.from(new Set([...localLevels, ...pretestLevels])).sort((a, b) => a - b);
    },
    [activeModule, masteredLevelsByModule, pretestModuleOutcomes.masteredBloomLevelsByModuleId],
  );

  const pages = useMemo(
    () => lessonPagesFor(activeModule, activeModuleMasteredLevels),
    [activeModule, activeModuleMasteredLevels],
  );
  const pageGroups = useMemo(
    () => lessonPageGroupsFor(activeModule, activeModuleMasteredLevels),
    [activeModule, activeModuleMasteredLevels],
  );
  const currentPage = pages[pageIndex] || pages[0];
  const effectiveCompletedIds = useMemo(
    () => {
      if (unlockAll) return new Set(allSteps.map((step) => step.module.id));
      const next = new Set(completedIds);
      pretestModuleOutcomes.exemptModuleIds.forEach((moduleId) => next.add(moduleId));
      if (foundationEvidence.passed) {
        foundationModuleIds.forEach((moduleId) => next.add(moduleId));
      }
      return next;
    },
    [unlockAll, allSteps, completedIds, foundationEvidence.passed, foundationModuleIds, pretestModuleOutcomes.exemptModuleIds],
  );
  const isActiveComplete = !!(activeStep && effectiveCompletedIds.has(activeStep.module.id));
  const unlockedCount = useMemo(
    () => (unlockAll ? Math.max(steps.length, 1) : computeUnlockedCount(steps, effectiveCompletedIds)),
    [unlockAll, steps, effectiveCompletedIds],
  );
  const defaultLeafGroup = useMemo(() => {
    if (pageGroups.length === 0) return null;
    return pageGroups.find((group) => group.key !== 'intro') ?? pageGroups[0];
  }, [pageGroups]);
  const currentGroup = useMemo(
    () => pageGroups.find((group) => group.key === currentPage?.kind) ?? pageGroups[0] ?? null,
    [currentPage, pageGroups],
  );
  const currentGroupPageIndex = useMemo(() => {
    if (!currentGroup || !currentPage) return 0;
    const idx = currentGroup.pages.findIndex(
      (p) => p.kind === currentPage.kind && p.subIndex === currentPage.subIndex,
    );
    return idx >= 0 ? idx : 0;
  }, [currentGroup, currentPage]);
  const visibleTheoryQuestionIndexes = useMemo(
    () => pages
      .filter((page) => page.kind === 'theoretical' && typeof page.subIndex === 'number')
      .map((page) => page.subIndex as number),
    [pages],
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
    currentPage?.kind === 'theoretical' &&
    visibleTheoryQuestionCount > 0 &&
    currentPage.subIndex === visibleTheoryQuestionIndexes[visibleTheoryQuestionIndexes.length - 1];
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
        const outcomes = derivePretestModuleOutcomes(modules, assessments);
        setFoundationEvidence(evidence);
        setPretestModuleOutcomes(outcomes);
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
        setPretestModuleOutcomes(EMPTY_PRETEST_OUTCOMES);
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
    }
  }, [allSteps, unlockAll]);

  const persistLearningProgress = useCallback(
    (nextCompletedIds: Set<string>, nextTheoryPassedIds: Set<string>) => {
      if (!token || unlockAll) return;
      const lastUnlockedModuleId = lastUnlockedModuleIdFor(allSteps, nextCompletedIds);
      saveLearningProgress(
        Array.from(nextCompletedIds),
        lastUnlockedModuleId,
        undefined,
        Array.from(nextTheoryPassedIds),
        lmsSessionId ?? undefined,
      ).catch((err) => {
        console.error('Failed to save learning progress:', err);
      });
    },
    [allSteps, lmsSessionId, token, unlockAll],
  );

  useEffect(() => {
    if (activeIndex >= steps.length && steps.length > 0) {
      setActiveIndex(steps.length - 1);
      setPageIndex(0);
    }
  }, [activeIndex, steps.length]);

  useEffect(() => {
    if (seededLeafView || !contentLoaded || !activeStep || !activeModule || !defaultLeafGroup || pages.length === 0) return;
    const targetPage = defaultLeafGroup.pages[0] || pages[0];
    const targetIndex = pages.findIndex((p) => p.kind === targetPage.kind && p.subIndex === targetPage.subIndex);
    setNav({
      level: 'pages',
      sectionId: activeStep.category,
      moduleId: activeModule.id,
      groupKey: defaultLeafGroup.key,
    });
    setPageIndex(targetIndex >= 0 ? targetIndex : 0);
    setSeededLeafView(true);
  }, [activeStep, activeModule, contentLoaded, defaultLeafGroup, pages, seededLeafView]);

  useEffect(() => {
    if (!contentLoaded || !activeStep || !activeModule || !currentPage || pageGroups.length === 0) return;
    const syncedGroup = pageGroups.find((group) => group.key === currentPage.kind) ?? pageGroups[0];
    if (!syncedGroup) return;
    setNav((prev) => {
      if (
        prev.level === 'pages' &&
        prev.sectionId === activeStep.category &&
        prev.moduleId === activeModule.id &&
        prev.groupKey === syncedGroup.key
      ) {
        return prev;
      }
      return {
        level: 'pages',
        sectionId: activeStep.category,
        moduleId: activeModule.id,
        groupKey: syncedGroup.key,
      };
    });
  }, [activeStep, activeModule, contentLoaded, currentPage, pageGroups]);

  useEffect(() => {
    if (!effectivePreTestCompleted && assessmentStatus !== 'loading') navigate('/pre-test');
  }, [assessmentStatus, effectivePreTestCompleted]);

  const goToStep = useCallback(
    (index: number, nextPageIndex = 0) => {
      if (index >= 0 && index < steps.length) {
        setActiveIndex(index);
        setPageIndex(nextPageIndex);
        const s = steps[index];
        setNav({ level: 'subsections', sectionId: s.category, moduleId: s.module.id });
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
      setTheoryPassedIds(nextTheoryPassedIds);
      setCompletedIds(nextCompletedIds);
      setPageIndex(0);
      persistLearningProgress(nextCompletedIds, nextTheoryPassedIds);
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
        setCompletedIds(nextCompletedIds);
        setPageIndex(0);
        persistLearningProgress(nextCompletedIds, nextTheoryPassedIds);
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
      unlockAll || isActiveComplete || (isSubmitGate && isTheoryPassed);

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
      setPageIndex(lessonPagesFor(prevModule, masteredLevelsByModule[prevModule.id] || []).length - 1);
      const prevStep = steps[prevIdx];
      setNav({ level: 'subsections', sectionId: prevStep.category, moduleId: prevStep.module.id });
    }
  };

  const jumpToPage = useCallback(
    (step: CourseStep, target: LessonPage) => {
      const targetModule = findModule(step.module.id);
      const targetPages = lessonPagesFor(targetModule, masteredLevelsByModule[step.module.id] || []);
      const pi = Math.max(
        0,
        targetPages.findIndex((p) => p.kind === target.kind && p.subIndex === target.subIndex),
      );
      if (step.globalIndex === activeIndex) setPageIndex(pi);
      else goToStep(step.globalIndex, pi);
    },
    [activeIndex, findModule, goToStep, masteredLevelsByModule],
  );

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

  const navGroup = nav.level !== 'sections' ? groups.find((g) => g.meta.id === nav.sectionId) : null;
  const navStep = nav.level === 'subsections' || nav.level === 'pages' ? steps.find((s) => s.module.id === nav.moduleId) : null;
  const navPageGroup = nav.level === 'pages' ? pageGroups.find((g) => g.key === nav.groupKey) : null;
  const navStepModuleId = navStep?.module.id ?? '';

  return (
    <main className="nt-student nt-student-course">
      <section className="nt-course-shell" aria-label="Learning path">
        <aside className="nt-course-sidebar" aria-label="Learning module outline" data-lenis-prevent>
          {nav.level === 'sections' ? (
            <>
              <div className="nt-course-sidebar__head">
                <p>Modules</p>
                <span>
                  {steps.length} to learn
                </span>
              </div>
              <ul className="nt-course-folder">
                {groups.map((g, i) => (
                  <li key={g.meta.id}>
                    <button
                      type="button"
                      className="nt-course-folder__row"
                      onClick={() => setNav({ level: 'modules', sectionId: g.meta.id })}
                    >
                      <span className="nt-course-folder__icon" aria-hidden="true">
                        +
                      </span>
                      <span className="nt-course-folder__label">
                        <small>Section {i + 1}</small>
                        {g.meta.name}
                      </span>
                      <span className="nt-course-folder__chev" aria-hidden="true">
                        &gt;
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {nav.level === 'modules' && navGroup ? (
            <>
              <div className="nt-course-sidebar__head nt-course-sidebar__head--nav">
                <button type="button" className="nt-course-back" onClick={() => setNav({ level: 'sections' })}>
                  &lt; Categories
                </button>
              </div>
              <p className="nt-course-folder__crumb">{navGroup.meta.name}</p>
              <ul className="nt-course-folder">
                {navGroup.steps.map((s) => {
                  const locked = s.globalIndex >= unlockedCount;
                  const done = effectiveCompletedIds.has(s.module.id);
                  const active = s.globalIndex === activeIndex;
                  const bypassed = foundationEvidence.passed && isFoundationModule(s.module);
                  return (
                    <li key={s.module.id}>
                      <button
                        type="button"
                        className="nt-course-folder__row"
                        data-active={active ? 'true' : undefined}
                        data-locked={locked ? 'true' : undefined}
                        data-done={done ? 'true' : undefined}
                        data-bypassed={bypassed ? 'true' : undefined}
                        disabled={locked}
                        title={locked ? 'Finish the previous module to unlock this one.' : undefined}
                        onClick={() => setNav({ level: 'subsections', sectionId: navGroup.meta.id, moduleId: s.module.id })}
                      >
                        <span className="nt-course-folder__icon" aria-hidden="true">
                          {locked ? 'L' : done ? 'V' : s.globalIndex + 1}
                        </span>
                        <span className="nt-course-folder__label">
                          <small>{s.module.eyebrow}</small>
                          {s.module.title}
                          {bypassed ? ' - Bypassed by pretest' : ''}
                        </span>
                        {!locked ? (
                          <span className="nt-course-folder__chev" aria-hidden="true">
                            &gt;
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {nav.level === 'subsections' && navGroup && navStep ? (
            <>
              <div className="nt-course-sidebar__head nt-course-sidebar__head--nav">
                <button type="button" className="nt-course-back" onClick={() => setNav({ level: 'modules', sectionId: navGroup.meta.id })}>
                  &lt; {navGroup.meta.name}
                </button>
              </div>
              <p className="nt-course-folder__crumb">{navStep.module.title}</p>

              {pageGroups.map((group) => {
                return (
                  <button
                    key={group.key}
                    type="button"
                    className="nt-course-folder__row nt-course-folder__row--anchor nt-course-folder__row--branch"
                    onClick={() => setNav({ level: 'pages', sectionId: navGroup.meta.id, moduleId: navStepModuleId, groupKey: group.key })}
                  >
                    <span className="nt-course-folder__icon" aria-hidden="true">
                      {group.pages.length}
                    </span>
                    <span className="nt-course-folder__label">
                      <small>{group.label}</small>
                      {group.pages[0]?.label}
                    </span>
                    <span className="nt-course-folder__chev" aria-hidden="true">
                      &gt;
                    </span>
                  </button>
                );
              })}
            </>
          ) : null}

          {nav.level === 'pages' && navGroup && navStep && navPageGroup ? (
            <>
              <div className="nt-course-sidebar__head nt-course-sidebar__head--nav">
                <button type="button" className="nt-course-back" onClick={() => setNav({ level: 'subsections', sectionId: navGroup.meta.id, moduleId: navStepModuleId })}>
                  &lt; {navStep.module.title}
                </button>
              </div>
              <p className="nt-course-folder__crumb">{navPageGroup.label}</p>
              <ul className="nt-course-folder">
                {navPageGroup.pages.map((p, i) => (
                  <li key={`${p.kind}-${p.subIndex ?? 'x'}`}>
                    <button
                      type="button"
                      className="nt-course-folder__row nt-course-folder__row--anchor nt-course-folder__row--leaf"
                      data-active={currentPage.kind === p.kind && currentPage.subIndex === p.subIndex ? 'true' : undefined}
                      onClick={() => jumpToPage(navStep, p)}
                    >
                      <span className="nt-course-folder__icon" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="nt-course-folder__label">
                        <small>{navPageGroup.label}</small>
                        {p.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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
                    <strong>
                      Step {currentGroupPageIndex + 1} of {currentGroup.pages.length}
                    </strong>
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
                  {currentPage.kind === 'intro' ? <IntroBody module={activeModule} /> : null}
                  {currentPage.kind === 'concepts' ? <ConceptsBody module={activeModule} subIndex={currentPage.subIndex} /> : null}
                  {currentPage.kind === 'examples' ? <ExamplesBody module={activeModule} subIndex={currentPage.subIndex} /> : null}
                  {currentPage.kind === 'theoretical' && activeModule.theoreticalExam ? (
                    <TheoreticalExamBlock
                      moduleId={activeModule.id}
                      exam={activeModule.theoreticalExam}
                      subIndex={currentPage.subIndex}
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
                          setTheoryPassedIds(nextTheoryPassedIds);
                          setPracticalDone((prev) => new Set(prev).add(activeModule.id));
                          setCompletedIds(nextCompletedIds);
                          setPageIndex(0);
                          persistLearningProgress(nextCompletedIds, nextTheoryPassedIds);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Could not save practical answer.');
                        } finally {
                          setPracticalSaving((prev) => ({ ...prev, [activeModule.id]: false }));
                        }
                      }}
                    />
                  ) : null}

                  {currentPage.kind === 'intro' ? (
                    <PrerequisiteBanner
                      steps={steps}
                      activeIndex={activeIndex}
                      isActiveComplete={isActiveComplete}
                      foundationBypassed={foundationEvidence.passed}
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

