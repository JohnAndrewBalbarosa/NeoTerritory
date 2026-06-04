import { useCallback, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  type LearningCategory,
  type LearningModule,
  type PracticalExam,
  type TheoreticalExam,
} from '../../../data/learningModules';
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

type LearnNavView =
  | { level: 'sections' }
  | { level: 'modules'; sectionId: LearningCategory }
  | { level: 'subsections'; sectionId: LearningCategory; moduleId: string };

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

function lessonPagesFor(module: LearningModule | undefined): ReadonlyArray<LessonPage> {
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
    module.theoreticalExam.questions.forEach((_, i) => {
      pages.push({ kind: 'theoretical', label: `Quiz Q${i + 1}`, subIndex: i });
    });
  }

  if (module.practicalExam) {
    pages.push({ kind: 'practical', label: 'Practical Exam' });
  }

  return pages;
}

function lessonPageGroupsFor(module: LearningModule | undefined): ReadonlyArray<LessonPageGroup> {
  if (!module) return [];

  const pages = lessonPagesFor(module);
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
}: {
  steps: ReadonlyArray<CourseStep>;
  activeIndex: number;
  isActiveComplete: boolean;
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
          <dd>{isActiveComplete ? 'Complete - the Next arrow is unlocked.' : 'Pending - step to the exam pages with > to attempt them.'}</dd>
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
  isPassed,
  onPass,
}: {
  moduleId: string;
  exam: TheoreticalExam;
  subIndex?: number;
  isPassed: boolean;
  onPass: () => void;
}): JSX.Element | null {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const qi = subIndex ?? 0;
  const q = exam.questions[qi];
  if (!q) return null;

  return (
    <section className="nt-exam__question" id={anchorId(moduleId, 'theoretical', subIndex)}>
      <p className="nt-exam__prompt">
        <span className="nt-exam__qnum">Q{qi + 1}</span>
        {q.question}
      </p>

      <ol className="nt-exam__questions">
        {q.options.map((opt, i) => (
          <li key={i}>
            <label className="nt-practical__choice" data-picked={answers[qi] === i ? 'true' : undefined}>
              <input
                type="radio"
                name={`q-${qi}`}
                checked={answers[qi] === i}
                onChange={() => setAnswers({ ...answers, [qi]: i })}
              />
              <span>{opt}</span>
            </label>
          </li>
        ))}
      </ol>

      {qi === exam.questions.length - 1 ? (
        <div className="nt-exam__submit-zone">
          {!isPassed ? (
            <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={onPass}>
              Submit Exam
            </button>
          ) : (
            <p className="nt-exam__verdict nt-exam__verdict--pass">Verified.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function PracticalExamBlock({
  moduleId,
  exam,
  isPassed,
  onPass,
}: {
  moduleId: string;
  exam: PracticalExam;
  isPassed: boolean;
  onPass: () => void;
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
        <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={onPass}>
          Confirm
        </button>
      ) : (
        <p className="nt-practical__verdict nt-practical__verdict--pass">Verified.</p>
      )}
    </section>
  );
}

export default function PatternsLearnPage(): JSX.Element {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const { findModule, modulesInCategory: modulesInCat, loaded: contentLoaded } = useLearningModules();
  const { groups, steps } = useMemo(() => buildCategoryGroups(modulesInCat), [contentLoaded, modulesInCat]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [nav, setNav] = useState<LearnNavView>({ level: 'sections' });
  const [openPageGroup, setOpenPageGroup] = useState<LessonPageKind>('intro');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [theoryPassedIds, setTheoryPassedIds] = useState<Set<string>>(new Set());

  const activeStep = steps[activeIndex];
  const activeModule = useMemo(
    () => (activeStep ? findModule(activeStep.module.id) : undefined),
    [activeStep, findModule],
  );
  const pages = useMemo(() => lessonPagesFor(activeModule), [activeModule]);
  const pageGroups = useMemo(() => lessonPageGroupsFor(activeModule), [activeModule]);
  const currentPage = pages[pageIndex] || pages[0];
  const isActiveComplete = !!(activeStep && completedIds.has(activeStep.module.id));
  const isActiveTheoryPassed = !!(activeStep && theoryPassedIds.has(activeStep.module.id));
  const unlockedCount = useMemo(() => computeUnlockedCount(steps, completedIds), [steps, completedIds]);

  useEffect(() => {
    setOpenPageGroup('intro');
  }, [activeStep?.module.id]);

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
    if (pageIndex < pages.length - 1) setPageIndex(pageIndex + 1);
    else if (activeIndex < steps.length - 1 && isActiveComplete) goToStep(activeIndex + 1);
    else if (activeIndex < steps.length - 1) alert('Complete exams to unlock next module.');
  };

  const goPrevPage = () => {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
    else if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      setPageIndex(lessonPagesFor(steps[prevIdx].module).length - 1);
      setOpenPageGroup('intro');
    }
  };

  const jumpToPage = useCallback(
    (step: CourseStep, target: LessonPage) => {
      const targetPages = lessonPagesFor(findModule(step.module.id));
      const pi = Math.max(
        0,
        targetPages.findIndex((p) => p.kind === target.kind && p.subIndex === target.subIndex),
      );
      setOpenPageGroup(target.kind);
      if (step.globalIndex === activeIndex) setPageIndex(pi);
      else goToStep(step.globalIndex, pi);
    },
    [activeIndex, findModule, goToStep],
  );

  if (!preTestCompleted) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem' }}>
        <h1>Locked</h1>
        <button type="button" onClick={() => navigate('/pre-test')}>
          Pre-test
        </button>
      </div>
    );
  }

  if (!contentLoaded || !activeModule) return <div>Loading...</div>;

  const navGroup = nav.level !== 'sections' ? groups.find((g) => g.meta.id === nav.sectionId) : null;
  const navStep = nav.level === 'subsections' ? steps.find((s) => s.module.id === nav.moduleId) : null;

  return (
    <main className="nt-student nt-student-course">
      <section className="nt-course-hero" aria-labelledby="learn-heading">
        <div>
          <p className="nt-section-eyebrow">Patterns / Learn</p>
          <h1 id="learn-heading" className="nt-student__title">
            Learning Path
          </h1>
          <p className="nt-student__lede">
            A {steps.length}-module step-through path across Foundations and the four pattern families.
          </p>
        </div>
      </section>

      <section className="nt-course-shell" aria-label="Learning path">
        <aside className="nt-course-sidebar" aria-label="Learning module outline" data-lenis-prevent>
          {nav.level === 'sections' ? (
            <>
              <div className="nt-course-sidebar__head">
                <p>Modules</p>
                <span>
                  {completedIds.size}/{steps.length} done
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
                  const done = completedIds.has(s.module.id);
                  const active = s.globalIndex === activeIndex;
                  return (
                    <li key={s.module.id}>
                      <button
                        type="button"
                        className="nt-course-folder__row"
                        data-active={active ? 'true' : undefined}
                        data-locked={locked ? 'true' : undefined}
                        data-done={done ? 'true' : undefined}
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
                const open = openPageGroup === group.key;
                return (
                  <div key={group.key} className={`nt-course-section${open ? ' is-open' : ''}`}>
                    <div className="nt-course-tree-row">
                      <button
                        type="button"
                        className="nt-course-outline nt-course-tree-nav"
                        onClick={() => {
                          const first = group.pages[0];
                          if (first) jumpToPage(navStep, first);
                        }}
                      >
                        <span className="nt-course-outline__dot" aria-hidden="true">
                          {group.pages.length}
                        </span>
                        <span>
                          <small>{group.label}</small>
                          {group.pages[0]?.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="nt-course-tree-disclosure"
                        onClick={() => setOpenPageGroup(open ? 'intro' : group.key)}
                        aria-label={open ? `Collapse ${group.label}` : `Expand ${group.label}`}
                      >
                        {open ? 'v' : '>'}
                      </button>
                    </div>

                    {open ? (
                      <div className="nt-course-section__body">
                        <ul className="nt-course-anchors">
                          {group.pages.map((p) => (
                            <li key={`${p.kind}-${p.subIndex ?? 'x'}`}>
                              <button
                                type="button"
                                className="nt-course-anchor"
                                data-active={currentPage.kind === p.kind && currentPage.subIndex === p.subIndex ? 'true' : undefined}
                                onClick={() => jumpToPage(navStep, p)}
                              >
                                {p.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
                <nav className="nt-pager__steprail" aria-label="Module sections">
                  {pages.map((p, i) => (
                    <button
                      key={`${p.kind}-${p.subIndex ?? 'x'}`}
                      type="button"
                      className="nt-pager__steptab"
                      data-active={i === pageIndex ? 'true' : undefined}
                      onClick={() => setPageIndex(i)}
                    >
                      <span className="nt-pager__steptab-n" aria-hidden="true">
                        {i + 1}
                      </span>
                      {p.label}
                    </button>
                  ))}
                </nav>
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
                      isPassed={isActiveTheoryPassed}
                      subIndex={currentPage.subIndex}
                      onPass={() => {
                        setTheoryPassedIds((prev) => new Set(prev).add(activeModule.id));
                      }}
                    />
                  ) : null}
                  {currentPage.kind === 'practical' && activeModule.practicalExam ? (
                    <PracticalExamBlock
                      moduleId={activeModule.id}
                      exam={activeModule.practicalExam}
                      isPassed={isActiveComplete}
                      onPass={() => {
                        setCompletedIds((prev) => new Set(prev).add(activeModule.id));
                        setTheoryPassedIds((prev) => new Set(prev).add(activeModule.id));
                      }}
                    />
                  ) : null}

                  {currentPage.kind === 'intro' ? (
                    <PrerequisiteBanner steps={steps} activeIndex={activeIndex} isActiveComplete={isActiveComplete} />
                  ) : null}
                </section>

                <button
                  type="button"
                  className="nt-pager__arrow nt-pager__arrow--next"
                  onClick={goNextPage}
                  disabled={pageIndex === pages.length - 1 && activeIndex === steps.length - 1}
                  aria-label="Next"
                >
                  &gt;
                </button>
              </div>

              <footer className="nt-pager__foot">
                <button type="button" className="nt-lesson-button" onClick={goPrevPage} disabled={pageIndex === 0 && activeIndex === 0}>
                  Previous
                </button>
                <span className="nt-pager__counter-text">
                  Step {pageIndex + 1} of {pages.length}
                </span>
                <button
                  type="button"
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={goNextPage}
                  disabled={pageIndex === pages.length - 1 && activeIndex === steps.length - 1}
                >
                  Next
                </button>
              </footer>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
