import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { learnModuleSlugFromPath, navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  type ExamQuestion,
  type LearningCategory,
  type LearningModule,
  type PracticalExam,
  type TheoreticalExam,
} from '../../../data/learningModules';
import { useLearningModules } from '../../../data/useLearningModules';
import {
  fetchLearningProgress,
  saveLearningProgress,
  saveLearningAnswers,
} from '../../../api/client';
import { useAppStore } from '../../../store/appState';
import StudioSurface from '../../studio/StudioSurface';

// D90: the /patterns/learn lesson panel is a SIDE-ARROW PAGER. Instead of one
// long scrolling page, each module's sections show one per view — Intro →
// Concepts → Examples → Theoretical Exam → Practical Exam — flanked by ‹ ›
// arrows that step through them and then roll into the next module once the
// exams pass. The folder sidebar (Sections → Modules → Subsections) stays; its
// subsection clicks jump the pager straight to that section's page.
//
//   - A module is COMPLETE when its theoretical passes (Foundations) AND its
//     practical passes if one exists (patterns). The linear cross-module gate
//     (computeUnlockedCount) then unlocks module N+1; the › arrow only spills
//     into the next module when the current one is complete.
//   - Within a module you can page freely to any section (the Practical page
//     shows its own "locked" callout until the theoretical passes).
//   - Signed-in learners persist completedModuleIds + theoryPassedModuleIds so
//     a mid-pattern-module refresh keeps the practical unlocked. Guests
//     (devcon*) keep progress in-memory for the visit only.

interface CourseStep {
  module: LearningModule;
  category: LearningCategory;
  globalIndex: number;
}

interface CategoryGroup {
  meta: (typeof CATEGORY_META)[number];
  steps: ReadonlyArray<CourseStep>;
}

// Sidebar drill-down folder state: one level visible at a time
type LearnNavView =
  | { level: 'sections' }
  | { level: 'modules'; sectionId: LearningCategory }
  | { level: 'subsections'; sectionId: LearningCategory; moduleId: string };

function lessonPagesFor(module: LearningModule | undefined): ReadonlyArray<LessonPage> {
  if (!module) return [];
  const pages: LessonPage[] = [{ kind: 'intro', label: 'Introduction' }];

  // Granular: one page per concept section
  module.sections.filter(s => !s.code).forEach((s, i) => {
    pages.push({ kind: 'concepts', label: s.heading || `Concept ${i+1}`, subIndex: i });
  });

  // Granular: one page per example
  module.sections.filter(s => !!s.code).forEach((s, i) => {
    pages.push({ kind: 'examples', label: s.heading || `Example ${i+1}`, subIndex: i });
  });

  // Granular: one page per quiz question
  if (module.theoreticalExam) {
    module.theoreticalExam.questions.forEach((_, i) => {
      pages.push({ kind: 'theoretical', label: `Quiz Q${i+1}`, subIndex: i });
    });
  }

  if (module.practicalExam) {
    pages.push({ kind: 'practical', label: 'Practical Exam' });
  }
  return pages;
}

export default function PatternsLearnPage(): JSX.Element {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const { findModule, modulesInCategory: modulesInCat, loaded: contentLoaded } = useLearningModules();
  const { groups, steps } = useMemo(() => buildCategoryGroups(modulesInCat), [contentLoaded, modulesInCat]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [nav, setNav] = useState<LearnNavView>({ level: 'sections' });

  const activeStep = steps[activeIndex];
  const activeModule = findModule(activeStep?.module.id);
  const pages = useMemo(() => lessonPagesFor(activeModule), [activeModule]);
  const currentPage = pages[pageIndex] || pages[0];

  // Auto-sync sidebar depth with current lesson
  useEffect(() => {
    if (activeStep) {
      setNav({ level: 'subsections', sectionId: activeStep.category, moduleId: activeStep.module.id });
    }
  }, [activeIndex]);

  if (!preTestCompleted) return <PreTestGate />;

  return (
    <main className="nt-student nt-student-course--viewport">
      <section className="nt-course-shell">
        <aside className="nt-course-sidebar--hierarchical">
          {nav.level === 'sections' && (
            <CategoryList groups={groups} onSelect={(id) => setNav({ level: 'modules', sectionId: id })} />
          )}
          {nav.level === 'modules' && (
            <ModuleList 
              group={groups.find(g => g.meta.id === nav.sectionId)!} 
              onBack={() => setNav({ level: 'sections' })}
              onSelect={(mId) => setNav({ level: 'subsections', sectionId: nav.sectionId, moduleId: mId })}
            />
          )}
          {nav.level === 'subsections' && (
            <SubsectionList 
              step={steps.find(s => s.module.id === nav.moduleId)!}
              onBack={() => setNav({ level: 'modules', sectionId: nav.sectionId })}
              activePageKind={currentPage.kind}
              activeSubIndex={currentPage.subIndex}
              onJump={(kind, sub) => {
                const idx = pages.findIndex(p => p.kind === kind && p.subIndex === sub);
                setPageIndex(idx >= 0 ? idx : 0);
              }}
            />
          )}
        </aside>

        <article className="nt-lesson-panel--viewport">
          <div className="nt-pager__viewport-container">
            <header className="nt-pager__header-sticky">
              <h2>{activeModule?.title} <small>— {currentPage.label}</small></h2>
            </header>
            
            <section className="nt-pager__content-no-scroll">
              <div className="nt-pager__granular-card">
                {/* Dynamically render only the specific subpage content */}
                <GranularContent module={activeModule!} page={currentPage} />
              </div>
            </section>

            <footer className="nt-pager__footer-sticky">
              <button onClick={() => setPageIndex(p => Math.max(0, p - 1))}>Previous</button>
              <span>{pageIndex + 1} / {pages.length}</span>
              <button className="primary" onClick={() => setPageIndex(p => Math.min(pages.length - 1, p + 1))}>Next</button>
            </footer>
          </div>
        </article>
      </section>
    </main>
  );
}

// ----- prerequisite banner: what unlocked THIS module, what's needed next -----

function describeExams(module: LearningModule | undefined): string {
  if (!module) return '';
  const parts: string[] = [];
  if (module.theoreticalExam) {
    const n = module.theoreticalExam.questions.length;
    parts.push(`a ${n}-question theoretical exam`);
  }
  if (module.practicalExam) {
    parts.push(`a Studio practical exam (analyser must tag ${module.practicalExam.patternName})`);
  }
  if (parts.length === 0) return 'No exam configured — advance with the › arrow when ready.';
  if (parts.length === 1) return `Pass ${parts[0]}.`;
  return `Pass ${parts[0]} first, which unlocks ${parts[1]}.`;
}

interface PrerequisiteBannerProps {
  steps: ReadonlyArray<CourseStep>;
  activeIndex: number;
  isActiveComplete: boolean;
}

function PrerequisiteBanner({ steps, activeIndex, isActiveComplete }: PrerequisiteBannerProps): JSX.Element | null {
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
              ? 'This is the first module of the path — always unlocked.'
              : prev
                ? <>Previous module &ldquo;<strong>{prev.module.title}</strong>&rdquo; must be completed. ✓ Done.</>
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
              ? '✓ Complete — the Next arrow is unlocked.'
              : 'Pending — step to the exam pages with › to attempt them.'}
          </dd>
        </div>

        <div className="nt-lesson-prereq__row">
          <dt>To unlock the next module</dt>
          <dd>
            {next
              ? <>Complete this module to unlock &ldquo;<strong>{next.module.title}</strong>&rdquo;.</>
              : 'This is the final module of the path — no further unlock.'}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

// ----- lesson bodies: one per pager page (Intro / Concepts / Examples) -----

function IntroBody({ module }: { module: LearningModule }): JSX.Element {
  return (
    <div className="nt-learn__granular-page">
      <p className="nt-learn__module-intro nt-learn__module-intro--lead" id={anchorId(module.id, 'intro')}>
        {module.intro}
      </p>
    </div>
  );
}

function ConceptsBody({ module, subIndex }: { module: LearningModule; subIndex?: number }): JSX.Element {
  const conceptSections = module.sections.filter((s) => !s.code);
  const section = subIndex != null ? conceptSections[subIndex] : null;

  if (!section) return <div />;

  return (
    <div className="nt-learn__granular-page" id={anchorId(module.id, 'concepts', subIndex)}>
      <section className="nt-learn__module-section">
        <h3 className="nt-learn__module-section-head">{section.heading}</h3>
        {section.body ? <p className="nt-learn__module-section-body">{section.body}</p> : null}
        {section.bullets && section.bullets.length > 0 ? (
          <ul className="nt-learn__module-bullets">
            {section.bullets.map((b, i) => (
              <li key={`${module.id}-c-${subIndex}-b-${i}`}>{b}</li>
            ))}
          </ul>
        ) : null}
        {section.note ? <p className="nt-learn__module-note">{section.note}</p> : null}
      </section>

      {/* Show key terms and summary only on the last concept page */}
      {subIndex === conceptSections.length - 1 && (
        <>
          {module.keyTerms && module.keyTerms.length > 0 && (
            <section className="nt-learn__module-section">
              <h3 className="nt-learn__module-section-head">Key terms</h3>
              <dl className="nt-learn__module-terms">
                {module.keyTerms.map((t) => (
                  <div className="nt-learn__module-term" key={`${module.id}-t-${t.term}`}>
                    <dt>{t.term}</dt>
                    <dd>{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {module.summary && (
            <section className="nt-learn__module-summary">
              <p className="nt-learn__module-summary-eyebrow">Summary</p>
              <p className="nt-learn__module-summary-body">{module.summary}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ExamplesBody({ module, subIndex }: { module: LearningModule; subIndex?: number }): JSX.Element | null {
  const exampleSections = module.sections.filter((s) => Boolean(s.code));
  const section = subIndex != null ? exampleSections[subIndex] : null;

  if (!section) return null;

  return (
    <div className="nt-learn__granular-page" id={anchorId(module.id, 'examples', subIndex)}>
      <section className="nt-learn__module-section">
        <h3 className="nt-learn__module-section-head">{section.heading}</h3>
        {section.body ? <p className="nt-learn__module-section-body">{section.body}</p> : null}
        {section.code ? (
          <pre className="nt-learn__module-code" aria-label="Code example">
            {section.code}
          </pre>
        ) : null}
        {section.note ? <p className="nt-learn__module-note">{section.note}</p> : null}
      </section>
      
      {subIndex === exampleSections.length - 1 && <SeeAlsoFooter module={module} />}
    </div>
  );
}

// ----- Theoretical Exam: multi-page MCQ, one question per subIndex -----

interface TheoreticalExamBlockProps {
  moduleId: string;
  exam: TheoreticalExam;
  isPassed: boolean;
  subIndex?: number;
  onPass: (tries: number) => void;
  onRecordAnswers?: (attempt: number, answers: { questionIndex: number; selectedIndex: number; isCorrect: boolean }[]) => void;
}

function TheoreticalExamBlock({ 
  moduleId, exam, isPassed, subIndex, onPass, onRecordAnswers 
}: TheoreticalExamBlockProps): JSX.Element {
  // Persistence for answers across sub-pages is tricky here if we remount.
  // We'll use the AppStore or a parent-lifted state if needed, but for now
  // let's try reading from the store if we have it, otherwise local.
  // Actually, TheoreticalExamBlock is keyed by moduleId, so it stays mounted
  // while we page through questions.
  const [answers, setAnswers] = useState<Record<number, number>>(() =>
    isPassed
      ? Object.fromEntries(exam.questions.map((q, i) => [i, q.correctIndex]))
      : {},
  );
  const [submitted, setSubmitted] = useState<boolean>(isPassed);
  const [tries, setTries] = useState<number>(0);

  const qi = subIndex ?? 0;
  const q = exam.questions[qi];
  const total = exam.questions.length;
  const isLastQ = qi === total - 1;
  const allAnswered = exam.questions.every((_, i) => answers[i] != null);

  const correctCount = exam.questions.reduce(
    (n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const passed = (submitted && correctCount === total) || isPassed;

  function pick(qIndex: number, optionIndex: number): void {
    if (passed || submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  }

  function handleSubmit(): void {
    if (!allAnswered) return;
    const attempt = tries + 1;
    setTries(attempt);
    setSubmitted(true);
    if (exam.questions.every((q, i) => answers[i] === q.correctIndex)) onPass(attempt);
    const recorded = exam.questions.map((q, i) => ({
      questionIndex: i,
      selectedIndex: answers[i],
      isCorrect: answers[i] === q.correctIndex,
    }));
    onRecordAnswers?.(attempt, recorded);
  }

  return (
    <div className="nt-learn__granular-page nt-exam--single-q">
      <header className="nt-exam__q-header">
        <span className="nt-exam__q-badge">Question {qi + 1} of {total}</span>
      </header>

      <section className="nt-exam__question">
        <p className="nt-exam__prompt">{q.question}</p>
        {q.code && (
          <pre className="nt-learn__module-code">{q.code}</pre>
        )}
        <ol className="nt-practical__choices">
          {q.options.map((opt, oi) => {
            const picked = answers[qi];
            const isPickedRow = picked === oi;
            const isCorrectRow = submitted && oi === q.correctIndex;
            const isWrongPick = submitted && isPickedRow && oi !== q.correctIndex;
            return (
              <li key={oi}>
                <label
                  className="nt-practical__choice"
                  data-picked={isPickedRow ? 'true' : undefined}
                  data-correct={isCorrectRow ? 'true' : undefined}
                  data-wrong={isWrongPick ? 'true' : undefined}
                >
                  <input
                    type="radio"
                    name={`exam-${moduleId}-${qi}`}
                    checked={isPickedRow}
                    disabled={passed || submitted}
                    onChange={() => pick(qi, oi)}
                  />
                  <span>{opt}</span>
                </label>
              </li>
            );
          })}
        </ol>
      </section>

      {isLastQ && (
        <div className="nt-exam__submit-zone">
          {!submitted && (
            <button
              type="button"
              className="nt-lesson-button nt-lesson-button--primary"
              onClick={handleSubmit}
              disabled={!allAnswered}
            >
              Submit final answers
            </button>
          )}
          {passed && <p className="nt-practical__verdict nt-practical__verdict--pass">✓ Passed!</p>}
          {submitted && !passed && (
            <div className="nt-practical__verdict nt-practical__verdict--fail">
              <p>✗ {correctCount}/{total} correct. Go back and check your answers.</p>
              <button type="button" className="nt-lesson-button" onClick={() => { setSubmitted(false); setAnswers({}); }}>Retry Exam</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ----- Practical Exam: Studio code-check, locked until theoretical passes -----

interface PracticalExamBlockProps {
  moduleId: string;
  exam: PracticalExam;
  isLocked: boolean;
  isPassed: boolean;
  // D92 auto-tag: when false the learner must click a manual confirm button
  // after detection fires; when true (default) detection auto-resolves.
  autoTag: boolean;
  onPass: () => void;
}

function PracticalExamBlock({ moduleId, exam, isLocked, isPassed, autoTag, onPass }: PracticalExamBlockProps): JSX.Element {
  const resetSession = useAppStore((s) => s.resetSession);
  const setSourceText = useAppStore((s) => s.setSourceText);
  const setFilename = useAppStore((s) => s.setFilename);
  // D92 detection_and_tests: the "all Studio unit tests passed for the current
  // run" flag. Reset to false on every new analysis (setCurrentRun), so it is
  // inherently per-run. The surface is remounted per module (key=moduleId), so
  // both this flag and the detection latch below are per-module.
  const gdbAllPassedForRun = useAppStore((s) => s.gdbAllPassedForRun);

  // D92 pass-mode gate. 'detection' (default) = pass on tag alone (today's
  // behaviour). 'detection_and_tests' additionally requires every Studio unit
  // test to pass before the practical completes.
  const passMode = exam.passMode ?? 'detection';

  // Whether the analyser has tagged the target pattern in the current run.
  // Latched per mount (StudioSurface itself only fires onPatternDetected once
  // per mount; we mirror that here so the manual/test gates can read it).
  const [detected, setDetected] = useState<boolean>(false);
  // onPass fires at most once per mount. Held in a ref so the effect below can
  // gate on it without re-subscribing.
  const passedRef = useRef<boolean>(false);

  // Seed/clear the embedded Studio only once the practical is actually unlocked,
  // so a locked module never clobbers the shared session. For order-sensitive
  // patterns (e.g. PIMPL) seed the scaffold so the learner can run-then-modify.
  useEffect(() => {
    if (isLocked) return;
    resetSession();
    if (exam.starterCode) {
      setSourceText(exam.starterCode);
      setFilename(`${exam.patternSlug}-submission.cpp`);
    }
    return () => resetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.patternSlug, isLocked]);

  // Single place that completes the practical, honouring the pass-mode gate and
  // the at-most-once latch. Manual-confirm (autoTag === false) routes through
  // here too, so the tests gate still applies to a manual confirmation.
  const tryComplete = useCallback(() => {
    if (passedRef.current) return;
    if (!detected) return;
    if (passMode === 'detection_and_tests' && !gdbAllPassedForRun) return;
    passedRef.current = true;
    onPass();
  }, [detected, passMode, gdbAllPassedForRun, onPass]);

  // StudioSurface fires this once when it tags the target pattern. We only
  // record detection here; the effect below (auto-tag) or the manual-confirm
  // button (autoTag === false) decides when the practical actually completes,
  // so the pass-mode gate is enforced uniformly in one place (tryComplete).
  const handleDetected = useCallback(() => {
    setDetected(true);
  }, []);

  // Re-evaluate completion whenever detection lands or the tests flip to green
  // (detection_and_tests). Skipped entirely when autoTag is false — that path
  // waits for the explicit manual-confirm click instead.
  useEffect(() => {
    if (!autoTag) return;
    tryComplete();
  }, [autoTag, detected, gdbAllPassedForRun, tryComplete]);

  const testsGate = passMode === 'detection_and_tests';
  const testsSatisfied = !testsGate || gdbAllPassedForRun;

  return (
    <section
      className="nt-practical nt-practical--studio"
      id={anchorId(moduleId, 'practical')}
      aria-label="Practical exam"
    >
      <header className="nt-practical__head">
        <p className="nt-practical__eyebrow">Practical Exam · Analyse in the Studio</p>
        <h3 className="nt-practical__title">
          Target pattern: <span className="nt-practical__target">{exam.patternName}</span>
        </h3>
        <p className="nt-practical__prompt">
          {exam.prompt} Submit your C++ in the Studio below — the module completes the
          moment the analyser tags <strong>{exam.patternName}</strong>
          {testsGate ? ' and you pass all unit tests in the Tests tab' : ''}
          {!autoTag ? ', then confirm the tag below' : ''}. Open the Patterns tab after
          analysis to read how each part of your code maps to the pattern.
        </p>
      </header>

      {isLocked ? (
        <div className="nt-lesson-callout" role="status">
          <span>Locked</span>
          Pass the Theoretical Exam (the previous page) to unlock the Practical Exam for this module.
        </div>
      ) : (
        <>
          {isPassed ? (
            <p className="nt-practical__verdict nt-practical__verdict--pass" role="status">
              ✓ Passed — the analyser tagged your class as <strong>{exam.patternName}</strong>.
              Re-run anytime, or press the › arrow to continue.
            </p>
          ) : detected ? (
            // Detection landed but the practical hasn't completed yet — explain
            // exactly what's still outstanding (tests and/or manual confirm).
            <p className="nt-practical__verdict nt-practical__verdict--progress" role="status">
              ✓ Pattern detected
              {testsGate
                ? testsSatisfied
                  ? ' — unit tests passed'
                  : ' — now pass all unit tests in the Tests tab'
                : ''}
              {!autoTag ? ' — confirm the tag below to complete this module' : ''}
              {autoTag && !testsGate ? '.' : ''}
            </p>
          ) : null}

          {!autoTag && !isPassed ? (
            <div className="nt-practical__footer">
              <button
                type="button"
                className="nt-lesson-button nt-lesson-button--primary"
                onClick={tryComplete}
                disabled={!detected || (testsGate && !gdbAllPassedForRun)}
                title={
                  !detected
                    ? `Analyse your code first — the analyser must tag ${exam.patternName}.`
                    : testsGate && !gdbAllPassedForRun
                      ? 'Pass all unit tests in the Tests tab first.'
                      : undefined
                }
              >
                Confirm: my class implements {exam.patternName}
              </button>
            </div>
          ) : null}

          <div className="nt-practical__studio" data-testid="practical-studio">
            <StudioSurface
              targetPatternSlug={exam.patternSlug}
              targetPatternName={exam.patternName}
              onPatternDetected={handleDetected}
            />
          </div>
        </>
      )}
    </section>
  );
}

// ----- page -----

export default function PatternsLearnPage(): JSX.Element {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);

  // D92 Track C: content source. Loads published modules from the CMS API and
  // falls back to the bundled static LEARNING_MODULES on any error/empty, so the
  // page renders identically whether the API is up, down, or unseeded.
  const {
    loaded: contentLoaded,
    findModule,
    modulesInCategory: modulesInCat,
    modules,
  } = useLearningModules();

  // Rebuild the path whenever the loaded module list changes (static → api).
  // Same {groups, steps} ordering as before; the unlock math + clamping already
  // recompute off `steps`.
  const { groups, steps } = useMemo(
    () => buildCategoryGroups(modulesInCat),
    // modulesInCat is memoised on `modules`; depend on the list to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules],
  );

  const token = useAppStore((s) => s.token);
  const user = useAppStore((s) => s.user);
  // Guests run on a shared devcon{N} seat: the analyser works (they hold a
  // token) but their learning progress is NOT persisted server-side.
  const isGuest = (user?.username || '').toLowerCase().startsWith('devcon');
  const lmsSessionId = useAppStore((s) => s.lmsSessionId);
  const setLmsSessionId = useAppStore((s) => s.setLmsSessionId);
  // D92 (User Direction): Guests save progress for research but don't load it
  // back, ensuring an ephemeral experience for them while the backend collects data.
  const canPersist = !!token;

  // completedIds = modules fully done (theory + practical-if-any). theoryPassedIds
  // = modules whose theoretical exam passed (superset of completedIds for pattern
  // modules mid-flight). triesByModule = theoretical attempt counts.
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [theoryPassedIds, setTheoryPassedIds] = useState<Set<string>>(() => new Set());
  const [triesByModule, setTriesByModule] = useState<Record<string, number>>({});

  const unlockedCount = useMemo(
    () => computeUnlockedCount(steps, completedIds),
    [steps, completedIds],
  );

  const [progressLoaded, setProgressLoaded] = useState<boolean>(false);
  // Only persist after the user has made a local change — guards against
  // clobbering server progress with the empty initial set on load.
  const dirtyRef = useRef<boolean>(false);

  // Hydrate progress from the account on mount / sign-in.
  useEffect(() => {
    // D92 (User Direction): Guests skip loading (ephemeral session) but still 
    // allow saving for backend research.
    if (!token || isGuest) {
      setProgressLoaded(true);
      return;
    }
    let cancelled = false;
    void fetchLearningProgress()
      .then((p) => {
        if (cancelled) return;
        const completed = p.completedModuleIds ?? [];
        const theory = p.theoryPassedModuleIds ?? [];
        if (completed.length) {
          setCompletedIds((prev) => {
            const next = new Set(prev);
            for (const id of completed) next.add(id);
            return next;
          });
        }
        // A completed module's theoretical is necessarily passed; union both.
        if (completed.length || theory.length) {
          setTheoryPassedIds((prev) => {
            const next = new Set(prev);
            for (const id of theory) next.add(id);
            for (const id of completed) next.add(id);
            return next;
          });
        }
      })
      .catch(() => {
        /* offline / first visit — start empty */
      })
      .finally(() => {
        if (!cancelled) setProgressLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canPersist]);

  // Persist completed + theory-passed sets whenever they change, but only after
  // load and only once the learner has actually mutated progress. Fire-and-
  // forget; idempotent so a dropped write self-heals on the next change.
  useEffect(() => {
    if (!canPersist || !progressLoaded || !dirtyRef.current) return;
    const ids = steps.map((s) => s.module.id).filter((id) => completedIds.has(id));
    const theoryIds = steps.map((s) => s.module.id).filter((id) => theoryPassedIds.has(id));
    const unlocked = computeUnlockedCount(steps, completedIds);
    const lastUnlockedModuleId =
      steps.length > 0 ? steps[Math.max(0, Math.min(unlocked, steps.length) - 1)].module.id : null;
    void saveLearningProgress(ids, lastUnlockedModuleId, triesByModule, theoryIds).catch(() => {
      /* best-effort; resent on next change */
    });
  }, [canPersist, progressLoaded, steps, completedIds, theoryPassedIds, triesByModule]);

  const [activeIndex, setActiveIndex] = useState<number>(() =>
    clampToUnlocked(indexFromUrl(steps), steps.length || 1),
  );

  const navUnlocked = progressLoaded ? unlockedCount : steps.length || 1;

  const [redirectNotice, setRedirectNotice] = useState<{
    requestedTitle: string;
    requestedId: string;
    landedTitle: string;
    requiredCount: number;
  } | null>(null);

  // Keep activeIndex synced when the URL changes (back button, deep links,
  // see-also click), clamped to the unlock gate.
  useEffect(() => {
    function recompute(): void {
      setActiveIndex(clampToUnlocked(indexFromUrl(steps), navUnlocked));
    }
    window.addEventListener('popstate', recompute);
    window.addEventListener('nt:navigate', recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener('nt:navigate', recompute);
    };
  }, [steps, navUnlocked]);

  // Bounce a locked deep link back to the highest unlocked module and surface a
  // visible notice describing the gate the user hit.
  useEffect(() => {
    if (steps.length === 0) return;
    if (!progressLoaded) return;
    const fromUrl = indexFromUrl(steps);
    const clamped = clampToUnlocked(fromUrl, unlockedCount);
    if (clamped !== fromUrl) {
      const requestedStep = steps[fromUrl];
      const landedStep = steps[clamped];
      if (requestedStep && landedStep) {
        setRedirectNotice({
          requestedTitle: requestedStep.module.title,
          requestedId: requestedStep.module.id,
          landedTitle: landedStep.module.title,
          requiredCount: fromUrl - clamped,
        });
      }
      navigate(`/patterns/learn/${steps[clamped].module.id}`);
      setActiveIndex(clamped);
    }
  }, [steps, unlockedCount, progressLoaded]);

  useEffect(() => {
    if (!redirectNotice) return;
    const requestedIndex = steps.findIndex((s) => s.module.id === redirectNotice.requestedId);
    if (requestedIndex === -1 || requestedIndex < unlockedCount) {
      setRedirectNotice(null);
    }
  }, [redirectNotice, steps, unlockedCount]);

  const activeStep = steps[activeIndex];
  const activeModule: LearningModule | undefined = activeStep
    ? findModule(activeStep.module.id)
    : undefined;

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      if (index >= unlockedCount) return;
      const target = steps[index];
      navigate(`/patterns/learn/${target.module.id}`);
      setActiveIndex(index);
    },
    [steps, unlockedCount],
  );

  // Theoretical exam passed: record the attempt count, mark theory-passed, and
  // — for modules with no practical — mark complete (which unlocks the next).
  const markTheoryPassed = useCallback((moduleId: string, tries: number) => {
    dirtyRef.current = true;
    setTriesByModule((prev) => (prev[moduleId] != null ? prev : { ...prev, [moduleId]: tries }));
    setTheoryPassedIds((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)));
    const mod = findModule(moduleId);
    if (!mod?.practicalExam) {
      setCompletedIds((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)));
    }
  }, [findModule]);

  // Practical exam passed: the module is now complete (theory was the gate to
  // reach the practical, so it is already in theoryPassedIds).
  const markPracticalPassed = useCallback((moduleId: string) => {
    dirtyRef.current = true;
    setCompletedIds((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)));
    setTheoryPassedIds((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)));
  }, []);

  // ---- pager: one section per view, navigated by the side ‹ › arrows ----
  const pages = useMemo(() => lessonPagesFor(activeModule), [activeModule]);
  const [pageIndex, setPageIndex] = useState<number>(0);
  // When the active module changes, the next render resets the pager to this
  // target: 'first' (Intro) on forward nav, 'last' when stepping back into the
  // previous module, or an explicit index for a sidebar subsection jump.
  const pendingPageRef = useRef<number | 'first' | 'last'>('first');

  useEffect(() => {
    const n = pages.length;
    const p = pendingPageRef.current;
    let target = 0;
    if (p === 'last') target = Math.max(0, n - 1);
    else if (typeof p === 'number') target = Math.min(Math.max(0, p), Math.max(0, n - 1));
    setPageIndex(target);
    pendingPageRef.current = 'first';
  }, [pages]);

  const safePage = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const currentPage = pages[safePage];

  const isFirst = activeIndex === 0;
  const total = steps.length;
  const isLast = activeIndex === total - 1;
  const isActiveComplete = !!(activeStep && completedIds.has(activeStep.module.id));
  const isActiveTheoryPassed = !!(activeStep && theoryPassedIds.has(activeStep.module.id));

  const atFirstPage = safePage <= 0;
  const atLastPage = safePage >= pages.length - 1;
  // ‹ : page back within the module, else roll into the previous module's last
  // page. Disabled only at the very first page of the very first module.
  const goPrevPage = useCallback(() => {
    if (safePage > 0) {
      setPageIndex(safePage - 1);
      return;
    }
    if (activeIndex > 0) {
      pendingPageRef.current = 'last';
      goToStep(activeIndex - 1);
    }
  }, [safePage, activeIndex, goToStep]);

  // › : page forward within the module (free — the Practical page shows its own
  // locked callout), else roll into the next module, gated by completion.
  const goNextPage = useCallback(() => {
    if (safePage < pages.length - 1) {
      setPageIndex(safePage + 1);
      return;
    }
    if (!activeStep || !completedIds.has(activeStep.module.id)) return;
    if (activeIndex < steps.length - 1) {
      pendingPageRef.current = 'first';
      goToStep(activeIndex + 1);
    }
  }, [safePage, pages.length, activeStep, completedIds, activeIndex, steps.length, goToStep]);

  const prevDisabled = atFirstPage && isFirst;
  const nextIsModuleAdvance = atLastPage;
  const nextDisabled = atLastPage && (!isActiveComplete || isLast);
  const nextLabel = !atLastPage
    ? 'Next ›'
    : isLast
      ? isActiveComplete
        ? 'Path complete'
        : 'Finish the exams'
      : isActiveComplete
        ? 'Next module ›'
        : 'Locked';
  const nextGateTitle = nextDisabled
    ? isLast
      ? 'You finished the last module.'
      : 'Complete this module’s exams to unlock the next module.'
    : undefined;

  // Sidebar drill-down folder — chrome only, not persisted. Defaults to the
  // active module's subsections so the rail shows where you are; the back button
  // walks up to that module's section, then to all sections.
  const activeFamily = activeStep?.category;
  const activeModuleId = activeStep?.module.id;

  const [nav, setNav] = useState<LearnNavView>(() =>
    activeStep
      ? { level: 'subsections', sectionId: activeStep.category, moduleId: activeStep.module.id }
      : { level: 'sections' },
  );

  // Follow the active module: when it changes (folder click, Next/Prev, deep
  // link), surface that module's subsections. Manual back/drill that doesn't
  // change the active module is preserved (this effect only fires on change).
  useEffect(() => {
    if (activeFamily && activeModuleId) {
      setNav({ level: 'subsections', sectionId: activeFamily, moduleId: activeModuleId });
    }
  }, [activeFamily, activeModuleId]);

  // Clicking a sidebar subsection: navigate to that module if needed, then jump
  // the pager straight to the matching page (no scrolling).
  const handlePageJump = useCallback(
    (step: CourseStep, kind: LessonPageKind) => {
      const targetPages = lessonPagesFor(findModule(step.module.id));
      const pi = Math.max(0, targetPages.findIndex((p) => p.kind === kind));
      if (step.globalIndex === activeIndex) {
        setPageIndex(pi);
      } else {
        pendingPageRef.current = pi;
        goToStep(step.globalIndex);
      }
    },
    [activeIndex, goToStep, findModule],
  );

  const completedCount = completedIds.size;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const totalTries = Object.values(triesByModule).reduce((a, b) => a + b, 0);

  // Resolve the folder level currently shown in the sidebar.
  const navGroup =
    nav.level !== 'sections' ? groups.find((g) => g.meta.id === nav.sectionId) : undefined;
  const navStep =
    nav.level === 'subsections' ? steps.find((s) => s.module.id === nav.moduleId) : undefined;

  const familyName = CATEGORY_META.find((m) => m.id === activeStep?.category)?.name ?? '';

  if (!preTestCompleted) {
    return (
      <main className="nt-student nt-student-course" id="main">
        <section className="nt-course-hero">
          <div style={{ textAlign: 'center', padding: '4rem 1rem', width: '100%' }}>
            <h1 className="nt-student__title">Learning Path Locked</h1>
            <p className="nt-student__lede">
              Please complete the Pre-test baseline assessment to unlock your personalized learning path.
            </p>
            <button 
              className="nt-lesson-button nt-lesson-button--primary"
              onClick={() => navigate('/pre-test')}
              style={{ marginTop: '2rem', padding: '1rem 3rem', fontSize: '1.2rem' }}
            >
              Start Pre-test
            </button>
          </div>
        </section>
      </main>
    );
  }

  // D92 Track C: hold the full path render until the content source has resolved
  // (API or static fallback). Reuses the nt-student shell so the skip-link
  // target (#main) and page chrome stay consistent; the routes-manifest
  // data-testid lives on the parent StudentLearningShell, so this gate never
  // affects the smoke. The existing progressLoaded gating for the unlock math is
  // separate and still applies once we render below.
  if (!contentLoaded) {
    return (
      <main className="nt-student nt-student-course" id="main">
        <section className="nt-course-hero" aria-labelledby="learn-heading">
          <div>
            <p className="nt-section-eyebrow">Patterns · Learn</p>
            <h1 id="learn-heading" className="nt-student__title">
              Learning Path
            </h1>
            <p className="nt-student__lede" role="status" aria-live="polite">
              Loading the learning path…
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nt-student nt-student-course" id="main">
      <section className="nt-course-hero" aria-labelledby="learn-heading">
        <div>
          <p className="nt-section-eyebrow">Patterns · Learn</p>
          <h1 id="learn-heading" className="nt-student__title">
            Learning Path
          </h1>
          <p className="nt-student__lede">
            A {total}-module step-through path across Foundations and the four pattern families.
            Each module pages through Intro → Concepts → Examples, then a Theoretical Exam — and, for
            pattern modules, a Studio Practical Exam. Use the ‹ › arrows; complete a module to unlock the next.
          </p>
          <p className="nt-course-hero__audience">
            Pass the theoretical exam to unlock the practical exam; pattern modules complete once
            the analyser tags the target pattern. Signed-in learners keep progress across devices;
            guests keep it only for the current visit.
          </p>
        </div>
        <div className="nt-course-progress" aria-label={`Module progress ${progress}%`}>
          <span>{progress}%</span>
          <p>
            {completedCount}/{total} modules complete
            {totalTries > 0 ? ` · ${totalTries} exam attempt${totalTries === 1 ? '' : 's'}` : ''}
          </p>
          <div className="nt-course-progress__bar" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="nt-course-shell" aria-label="Learning path">
        <aside
          className="nt-course-sidebar nt-course-sidebar--hierarchical"
          aria-label="Learning module outline"
          data-lenis-prevent
        >
          {/* Level 1 — Sections (Families) */}
          {nav.level === 'sections' && (
            <>
              <div className="nt-course-sidebar__head">
                <p>Course Content</p>
                <span>{progress}% complete</span>
              </div>
              <ul className="nt-lms-folder">
                {groups.map((g, idx) => (
                  <li key={g.meta.id}>
                    <button
                      className="nt-lms-folder__row"
                      onClick={() => setNav({ level: 'modules', sectionId: g.meta.id })}
                    >
                      <span className="nt-lms-folder__icon">▦</span>
                      <span className="nt-lms-folder__label">
                        <small>Category {idx + 1}</small>
                        {g.meta.name}
                      </span>
                      <span className="nt-lms-folder__chev">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Level 2 — Modules in Section */}
          {nav.level === 'modules' && navGroup && (
            <>
              <div className="nt-course-sidebar__head">
                <button className="nt-lms-back" onClick={() => setNav({ level: 'sections' })}>
                  ‹ All Categories
                </button>
              </div>
              <p className="nt-lms-folder__crumb">{navGroup.meta.name}</p>
              <ul className="nt-lms-folder">
                {navGroup.steps.map((step) => {
                  const isModDone = completedIds.has(step.module.id);
                  const isModLocked = step.globalIndex > unlockedCount;
                  return (
                    <li key={step.module.id}>
                      <button
                        className="nt-lms-folder__row"
                        data-active={step.globalIndex === activeIndex ? 'true' : undefined}
                        disabled={isModLocked}
                        onClick={() => setNav({ level: 'subsections', sectionId: navGroup.meta.id, moduleId: step.module.id })}
                      >
                        <span className="nt-lms-folder__icon">
                          {isModLocked ? '🔒' : isModDone ? '✓' : '○'}
                        </span>
                        <span className="nt-lms-folder__label">{step.module.title}</span>
                        {!isModLocked && <span className="nt-lms-folder__chev">›</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Level 3 — Subsections in Module */}
          {nav.level === 'subsections' && navGroup && navStep && (
            <>
              <div className="nt-course-sidebar__head">
                <button className="nt-lms-back" onClick={() => setNav({ level: 'modules', sectionId: navGroup.meta.id })}>
                  ‹ {navGroup.meta.name}
                </button>
              </div>
              <p className="nt-lms-folder__crumb">{navStep.module.title}</p>
              <ul className="nt-lms-folder">
                {lessonPagesFor(navStep.module).map((p) => {
                  const isPageActive = navStep.globalIndex === activeIndex && currentPage?.kind === p.kind;
                  return (
                    <li key={p.kind}>
                      <button
                        className="nt-lms-folder__row"
                        data-active={isPageActive ? 'true' : undefined}
                        onClick={() => handlePageJump(navStep, p.kind)}
                      >
                        <span className="nt-lms-folder__icon">
                          {p.kind === 'theoretical' ? '📝' : p.kind === 'practical' ? '💻' : '📄'}
                        </span>
                        <span className="nt-lms-folder__label">{p.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <article className="nt-lesson-panel nt-lesson-pager nt-lesson-pager--viewport">
          {redirectNotice ? (
            <aside className="nt-lesson-redirect-notice" role="status" aria-live="polite">
              <div className="nt-lesson-redirect-notice__body">
                <p className="nt-lesson-redirect-notice__title">
                  &ldquo;{redirectNotice.requestedTitle}&rdquo; is locked
                </p>
                <p className="nt-lesson-redirect-notice__detail">
                  Finish {redirectNotice.requiredCount}{' '}
                  more module{redirectNotice.requiredCount === 1 ? '' : 's'} to unlock it.
                  You&rsquo;re now on &ldquo;{redirectNotice.landedTitle}&rdquo; — complete it to
                  keep moving forward.
                </p>
              </div>
              <button
                type="button"
                className="nt-lesson-redirect-notice__dismiss"
                aria-label="Dismiss locked-module notice"
                onClick={() => setRedirectNotice(null)}
              >
                ×
              </button>
            </aside>
          ) : null}

          {activeModule && currentPage ? (
            <div className="nt-pager__container">
              <header className="nt-pager__header-sticky">
                <div className="nt-pager__meta-top">
                  <p className="nt-pager__category-label">{familyName}</p>
                  <h2 className="nt-pager__main-title">
                    {activeModule.title} <span className="nt-pager__step-name">— {currentPage.label}</span>
                  </h2>
                </div>
                <div className="nt-pager__step-progress">
                  {pages.map((p, i) => (
                    <button
                      key={p.kind}
                      className="nt-pager__step-dot"
                      data-active={i === safePage ? 'true' : undefined}
                      data-done={(p.kind === 'theoretical' && isActiveTheoryPassed) || (p.kind === 'practical' && isActiveComplete) ? 'true' : undefined}
                      onClick={() => setPageIndex(i)}
                      title={p.label}
                    />
                  ))}
                </div>
              </header>

                <section className="nt-pager__content-area" data-lenis-prevent>
                <div className="nt-pager__card">
                  {currentPage.kind === 'intro' && (
                    <>
                      <IntroBody module={activeModule} />
                      <PrerequisiteBanner
                        steps={steps}
                        activeIndex={activeIndex}
                        isActiveComplete={isActiveComplete}
                      />
                    </>
                  )}
                  {currentPage.kind === 'concepts' && <ConceptsBody module={activeModule} subIndex={currentPage.subIndex} />}
                  {currentPage.kind === 'examples' && <ExamplesBody module={activeModule} subIndex={currentPage.subIndex} />}
                  
                  {currentPage.kind === 'theoretical' && activeModule.theoreticalExam ? (
                    <TheoreticalExamBlock
                      key={`${activeModule.id}-theory`}
                      moduleId={activeModule.id}
                      exam={activeModule.theoreticalExam}
                      isPassed={isActiveTheoryPassed}
                      subIndex={currentPage.subIndex}
                      onPass={(tries) => markTheoryPassed(activeModule.id, tries)}
                      onRecordAnswers={(attempt, recorded) => {
                        if (!canPersist) return;
                        void saveLearningAnswers(activeModule.id, attempt, recorded, lmsSessionId || undefined).catch(() => {});
                      }}
                    />
                  ) : null}

                  {currentPage.kind === 'practical' && activeModule.practicalExam ? (
                    <PracticalExamBlock
                      key={`${activeModule.id}-practical`}
                      moduleId={activeModule.id}
                      exam={activeModule.practicalExam}
                      isLocked={!isActiveTheoryPassed}
                      isPassed={isActiveComplete}
                      autoTag={activeModule.autoTag !== false}
                      onPass={() => markPracticalPassed(activeModule.id)}
                    />
                  ) : null}

                  {isActiveComplete && isLast && (
                    <div className="nt-lms-final-gate">
                      <h3>🎉 Path Complete!</h3>
                      <p>You have finished the entire learning course. Take the final post-test to finalize your assessment.</p>
                      <button className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/post-test')}>
                        Take Final Post-test
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <footer className="nt-pager__footer-sticky">
                <button
                  className="nt-lesson-button"
                  disabled={prevDisabled}
                  onClick={goPrevPage}
                >
                  ‹ Previous
                </button>
                
                <span className="nt-pager__counter-text">
                  Step {safePage + 1} of {pages.length}
                </span>

                <button
                  className="nt-lesson-button nt-lesson-button--primary"
                  onClick={goNextPage}
                  disabled={nextDisabled}
                  title={nextGateTitle}
                >
                  {nextLabel} ›
                </button>
              </footer>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
