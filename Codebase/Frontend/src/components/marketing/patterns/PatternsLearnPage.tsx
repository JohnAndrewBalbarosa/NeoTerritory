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

// Sidebar drill-down folder state: one level visible at a time, with a back
// button — Sections → Modules → Subsections (D86 revision per user request).
type LearnNavView =
  | { level: 'sections' }
  | { level: 'modules'; sectionId: LearningCategory }
  | { level: 'subsections'; sectionId: LearningCategory; moduleId: string };

// Pure builder: the loaded module source is injected as `modulesInCat` (the
// static one, or the API-backed one from useLearningModules). Ordering is
// unchanged — CATEGORY_META order outer, then the per-category order the source
// yields (the API already returns sort_order; the static list keeps its array
// order). D92 Track C.
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
    const grouped: CourseStep[] = inCat.map((module) => {
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

function indexFromUrl(steps: ReadonlyArray<CourseStep>): number {
  if (typeof window === 'undefined') return 0;
  const slug = learnModuleSlugFromPath(window.location.pathname);
  if (!slug) return 0;
  const idx = steps.findIndex((s) => s.module.id === slug);
  return idx >= 0 ? idx : 0;
}

// Linear unlock: module 0 is always reachable; module N is reachable only
// once module N-1 is complete (theoretical passed + practical passed if one
// exists). Driven by the completedIds set.
function computeUnlockedCount(
  steps: ReadonlyArray<CourseStep>,
  completedIds: ReadonlySet<string>,
): number {
  let n = 1;
  for (let i = 0; i < steps.length - 1; i++) {
    if (completedIds.has(steps[i].module.id)) n++;
    else break;
  }
  return Math.min(n, Math.max(steps.length, 1));
}

function clampToUnlocked(idx: number, unlockedCount: number): number {
  if (idx < 0) return 0;
  if (idx >= unlockedCount) return Math.max(0, unlockedCount - 1);
  return idx;
}

// ----- in-module section identity (shared by the pager + the sidebar) -----

type LessonPageKind = 'intro' | 'concepts' | 'examples' | 'theoretical' | 'practical';

interface LessonPage {
  kind: LessonPageKind;
  label: string;
}

function anchorId(moduleId: string, section: string): string {
  return `mod-${moduleId}-${section}`;
}

// The ordered pages a module exposes. Examples only appears when the module has
// at least one code-bearing section; the exam pages mirror the exams the module
// actually carries. This is the single source for both the pager steps and the
// sidebar subsection list, so they can never drift.
function lessonPagesFor(module: LearningModule | undefined): ReadonlyArray<LessonPage> {
  if (!module) return [];
  const hasExamples = module.sections.some((s) => Boolean(s.code));
  const pages: LessonPage[] = [
    { kind: 'intro', label: 'Intro' },
    { kind: 'concepts', label: 'Concepts' },
  ];
  if (hasExamples) pages.push({ kind: 'examples', label: 'Examples' });
  if (module.theoreticalExam) pages.push({ kind: 'theoretical', label: 'Theoretical Exam' });
  if (module.practicalExam) pages.push({ kind: 'practical', label: 'Practical Exam' });
  return pages;
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
  // The module title + family eyebrow already live in the pager head (visible on
  // every page), so the Intro page shows only the lead-in paragraph instead of
  // repeating them — keeps the reading area dense rather than header-heavy.
  return (
    <p className="nt-learn__module-intro nt-learn__module-intro--lead" id={anchorId(module.id, 'intro')}>
      {module.intro}
    </p>
  );
}

function ConceptsBody({ module }: { module: LearningModule }): JSX.Element {
  const conceptSections = module.sections.filter((s) => !s.code);

  return (
    <section className="nt-learn__module-group" id={anchorId(module.id, 'concepts')} aria-label="Concepts">
      <p className="nt-learn__group-eyebrow">Concepts</p>
      {conceptSections.map((s, idx) => (
        <section className="nt-learn__module-section" key={`${module.id}-c-${idx}`}>
          <h3 className="nt-learn__module-section-head">{s.heading}</h3>
          {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
          {s.bullets && s.bullets.length > 0 ? (
            <ul className="nt-learn__module-bullets">
              {s.bullets.map((b, i) => (
                <li key={`${module.id}-c-${idx}-b-${i}`}>{b}</li>
              ))}
            </ul>
          ) : null}
          {s.note ? <p className="nt-learn__module-note">{s.note}</p> : null}
        </section>
      ))}

      {module.keyTerms && module.keyTerms.length > 0 ? (
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
      ) : null}

      {module.summary ? (
        <section className="nt-learn__module-summary" aria-label="Module summary">
          <p className="nt-learn__module-summary-eyebrow">Summary</p>
          <p className="nt-learn__module-summary-body">{module.summary}</p>
        </section>
      ) : null}
    </section>
  );
}

function ExamplesBody({ module }: { module: LearningModule }): JSX.Element | null {
  const exampleSections = module.sections.filter((s) => Boolean(s.code));
  if (exampleSections.length === 0) return null;

  return (
    <section className="nt-learn__module-group" id={anchorId(module.id, 'examples')} aria-label="Examples">
      <p className="nt-learn__group-eyebrow">Examples</p>
      {exampleSections.map((s, idx) => (
        <section className="nt-learn__module-section" key={`${module.id}-e-${idx}`}>
          <h3 className="nt-learn__module-section-head">{s.heading}</h3>
          {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
          {s.code ? (
            <pre className="nt-learn__module-code" aria-label="Code example">
              {s.code}
            </pre>
          ) : null}
          {s.note ? <p className="nt-learn__module-note">{s.note}</p> : null}
        </section>
      ))}
    </section>
  );
}

function SeeAlsoFooter({ module }: { module: LearningModule }): JSX.Element | null {
  if (!module.seeAlso || module.seeAlso.length === 0) return null;

  return (
    <footer className="nt-learn__module-see-also" aria-label="Related modules">
      <p className="nt-learn__module-see-also-eyebrow">See also</p>
      <ul className="nt-learn__module-see-also-list">
        {module.seeAlso.map((sa) => (
          <li key={`${module.id}-sa-${sa.moduleId}`}>
            <button
              type="button"
              className="nt-learn__module-see-also-link"
              onClick={() => navigate(`/patterns/learn/${sa.moduleId}`)}
            >
              {sa.label} →
            </button>
          </li>
        ))}
      </ul>
    </footer>
  );
}

// ----- Theoretical Exam: multi-question MCQ, pass = all correct -----

interface TheoreticalExamBlockProps {
  moduleId: string;
  exam: TheoreticalExam;
  isPassed: boolean;
  onPass: (tries: number) => void;
  onRecordAnswers?: (attempt: number, answers: { questionIndex: number; selectedIndex: number; isCorrect: boolean }[]) => void;
}

function TheoreticalExamBlock({ moduleId, exam, isPassed, onPass, onRecordAnswers }: TheoreticalExamBlockProps): JSX.Element {
  // If the module is already passed (loaded from progress) pre-fill the correct
  // answers so the block renders in a read-only "review" state with green ticks.
  const [answers, setAnswers] = useState<Record<number, number>>(() =>
    isPassed
      ? Object.fromEntries(exam.questions.map((q, i) => [i, q.correctIndex]))
      : {},
  );
  const [submitted, setSubmitted] = useState<boolean>(isPassed);
  const [tries, setTries] = useState<number>(0);

  const total = exam.questions.length;
  const allAnswered = exam.questions.every((_, i) => answers[i] != null);
  const correctCount = exam.questions.reduce(
    (n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const passed = (submitted && correctCount === total) || isPassed;

  function pick(qIndex: number, optionIndex: number): void {
    if (passed) return;
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

  function handleRetry(): void {
    setSubmitted(false);
    setAnswers({});
  }

  return (
    <section
      className="nt-practical nt-practical--quiz"
      id={anchorId(moduleId, 'theoretical')}
      aria-label="Theoretical exam"
    >
      <header className="nt-practical__head">
        <p className="nt-practical__eyebrow">Theoretical Exam · Check your understanding</p>
        <h3 className="nt-practical__title">
          Answer all {total} question{total === 1 ? '' : 's'} correctly to pass.
        </h3>
      </header>

      <ol className="nt-exam__questions">
        {exam.questions.map((q: ExamQuestion, qi) => {
          const picked = answers[qi];
          return (
            <li key={`${moduleId}-q-${qi}`} className="nt-exam__question">
              <p className="nt-exam__prompt">
                <span className="nt-exam__qnum">Q{qi + 1}.</span> {q.question}
              </p>
              <ol className="nt-practical__choices">
                {q.options.map((opt, oi) => {
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
                          disabled={passed}
                          onChange={() => pick(qi, oi)}
                        />
                        <span>{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ol>
              {submitted && q.explanation ? (
                <p
                  className="nt-exam__explanation"
                  data-state={picked === q.correctIndex ? 'pass' : 'fail'}
                >
                  {picked === q.correctIndex ? '✓ ' : '✗ '}
                  {q.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="nt-practical__footer">
        {!submitted && (
          <button
            type="button"
            className="nt-lesson-button nt-lesson-button--primary"
            onClick={handleSubmit}
            disabled={!allAnswered}
            title={!allAnswered ? 'Answer every question before submitting.' : undefined}
          >
            Submit exam
          </button>
        )}
        {passed && (
          <p className="nt-practical__verdict nt-practical__verdict--pass" role="status">
            ✓ Theoretical exam passed.
            {tries > 0 && <span className="nt-practical__tries"> · {tries} attempt{tries === 1 ? '' : 's'}</span>}
          </p>
        )}
        {submitted && !passed && (
          <>
            <p className="nt-practical__verdict nt-practical__verdict--fail" role="status">
              ✗ {correctCount}/{total} correct. Re-read the Concepts page and try again.
            </p>
            <button type="button" className="nt-lesson-button" onClick={handleRetry}>
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ----- Practical Exam: Studio code-check, locked until theoretical passes -----

interface PracticalExamBlockProps {
  moduleId: string;
  exam: PracticalExam;
  isLocked: boolean;
  isPassed: boolean;
  onPass: () => void;
}

function PracticalExamBlock({ moduleId, exam, isLocked, isPassed, onPass }: PracticalExamBlockProps): JSX.Element {
  const resetSession = useAppStore((s) => s.resetSession);
  const setSourceText = useAppStore((s) => s.setSourceText);
  const setFilename = useAppStore((s) => s.setFilename);

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
          {exam.prompt} Submit your C++ in the Studio below — the module unlocks the
          moment the analyser tags <strong>{exam.patternName}</strong>. Open the
          Patterns tab after analysis to read how each part of your code maps to the pattern.
        </p>
      </header>

      {isLocked ? (
        <div className="nt-lesson-callout" role="status">
          <span>Locked</span>
          Pass the Theoretical Exam (the previous page) to unlock the Practical Exam for this module.
        </div>
      ) : (
        <>
          {isPassed && (
            <p className="nt-practical__verdict nt-practical__verdict--pass" role="status">
              ✓ Passed — the analyser tagged your class as <strong>{exam.patternName}</strong>.
              Re-run anytime, or press the › arrow to continue.
            </p>
          )}
          <div className="nt-practical__studio" data-testid="practical-studio">
            <StudioSurface
              targetPatternSlug={exam.patternSlug}
              targetPatternName={exam.patternName}
              onPatternDetected={onPass}
            />
          </div>
        </>
      )}
    </section>
  );
}

// ----- page -----

export default function PatternsLearnPage(): JSX.Element {
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
  const canPersist = !!token && !isGuest;

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
    if (!canPersist) {
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
          className="nt-course-sidebar"
          aria-label="Learning module outline"
          data-lenis-prevent
        >
          {/* Level 1 — Sections (families). Enter one to see its modules. */}
          {nav.level === 'sections' ? (
            <>
              <div className="nt-course-sidebar__head">
                <p>Modules</p>
                <span>{completedCount}/{total} done</span>
              </div>
              <ul className="nt-course-folder">
                {groups.map((g, idx) => {
                  const sectionDone = g.steps.filter((s) => completedIds.has(s.module.id)).length;
                  const hasActive = activeFamily === g.meta.id;
                  return (
                    <li key={g.meta.id}>
                      <button
                        type="button"
                        className="nt-course-folder__row"
                        data-active={hasActive ? 'true' : undefined}
                        onClick={() => setNav({ level: 'modules', sectionId: g.meta.id })}
                      >
                        <span className="nt-course-folder__icon" aria-hidden="true">▦</span>
                        <span className="nt-course-folder__label">
                          <small>Section {idx + 1}</small>
                          {g.meta.name}
                        </span>
                        <span className="nt-course-folder__meta">
                          {sectionDone}/{g.steps.length}
                        </span>
                        <span className="nt-course-folder__chev" aria-hidden="true">›</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {/* Level 2 — Modules in the chosen section. Enter one to study it + see its subsections. */}
          {nav.level === 'modules' && navGroup ? (
            <>
              <div className="nt-course-sidebar__head nt-course-sidebar__head--nav">
                <button
                  type="button"
                  className="nt-course-back"
                  onClick={() => setNav({ level: 'sections' })}
                >
                  ‹ All sections
                </button>
              </div>
              <p className="nt-course-folder__crumb">{navGroup.meta.name}</p>
              <ul className="nt-course-folder">
                {navGroup.steps.map((step) => {
                  const locked = step.globalIndex >= unlockedCount;
                  const done = completedIds.has(step.module.id);
                  const active = step.globalIndex === activeIndex;
                  return (
                    <li key={step.module.id}>
                      <button
                        type="button"
                        className="nt-course-folder__row"
                        data-active={active ? 'true' : undefined}
                        data-locked={locked ? 'true' : undefined}
                        data-done={done ? 'true' : undefined}
                        disabled={locked}
                        title={locked ? 'Finish the previous module to unlock this one.' : undefined}
                        onClick={() => goToStep(step.globalIndex)}
                      >
                        <span className="nt-course-folder__icon" aria-hidden="true">
                          {locked ? '\u{1F512}' : done ? '✓' : step.globalIndex + 1}
                        </span>
                        <span className="nt-course-folder__label">
                          <small>{step.module.eyebrow}</small>
                          {step.module.title}
                        </span>
                        {!locked ? (
                          <span className="nt-course-folder__chev" aria-hidden="true">›</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {/* Level 3 — Subsections (pages) of the chosen module. Click to jump the pager there. */}
          {nav.level === 'subsections' && navGroup && navStep ? (
            <>
              <div className="nt-course-sidebar__head nt-course-sidebar__head--nav">
                <button
                  type="button"
                  className="nt-course-back"
                  onClick={() => setNav({ level: 'modules', sectionId: navGroup.meta.id })}
                >
                  ‹ {navGroup.meta.name}
                </button>
              </div>
              <p className="nt-course-folder__crumb">{navStep.module.title}</p>
              <ul className="nt-course-folder nt-course-folder--anchors">
                {lessonPagesFor(navStep.module).map((p) => {
                  const here =
                    navStep.globalIndex === activeIndex && currentPage?.kind === p.kind;
                  return (
                    <li key={p.kind}>
                      <button
                        type="button"
                        className="nt-course-folder__row nt-course-folder__row--anchor"
                        data-active={here ? 'true' : undefined}
                        onClick={() => handlePageJump(navStep, p.kind)}
                      >
                        <span className="nt-course-folder__icon" aria-hidden="true">¶</span>
                        <span className="nt-course-folder__label">{p.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </aside>

        <article className="nt-lesson-panel nt-lesson-pager">
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
            <>
              <header className="nt-pager__head">
                <div className="nt-pager__head-main">
                  <p className="nt-pager__eyebrow">
                    {familyName} · Module {activeIndex + 1} of {total}
                  </p>
                  <h2 className="nt-pager__module-title">{activeModule.title}</h2>
                </div>
                <nav className="nt-pager__steprail" aria-label="Module sections">
                  {pages.map((p, i) => {
                    const isCur = i === safePage;
                    const practicalLocked = p.kind === 'practical' && !isActiveTheoryPassed;
                    return (
                      <button
                        key={p.kind}
                        type="button"
                        className="nt-pager__steptab"
                        data-active={isCur ? 'true' : undefined}
                        data-locked={practicalLocked ? 'true' : undefined}
                        onClick={() => setPageIndex(i)}
                      >
                        <span className="nt-pager__steptab-n" aria-hidden="true">{i + 1}</span>
                        {p.label}
                      </button>
                    );
                  })}
                </nav>
              </header>

              <div className="nt-pager__stage">
                <button
                  type="button"
                  className="nt-pager__arrow nt-pager__arrow--prev"
                  onClick={goPrevPage}
                  disabled={prevDisabled}
                  aria-label={atFirstPage ? 'Previous module' : 'Previous section'}
                  title={prevDisabled ? 'Start of the path.' : undefined}
                >
                  ‹
                </button>

                <section
                  className="nt-pager__page"
                  key={`${activeModule.id}-${currentPage.kind}`}
                  data-lenis-prevent
                  aria-label={currentPage.label}
                >
                  {currentPage.kind === 'intro' ? (
                    <>
                      <IntroBody module={activeModule} />
                      <PrerequisiteBanner
                        steps={steps}
                        activeIndex={activeIndex}
                        isActiveComplete={isActiveComplete}
                      />
                    </>
                  ) : null}

                  {currentPage.kind === 'concepts' ? (
                    <>
                      <ConceptsBody module={activeModule} />
                      {!activeModule.sections.some((s) => Boolean(s.code)) ? (
                        <SeeAlsoFooter module={activeModule} />
                      ) : null}
                    </>
                  ) : null}

                  {currentPage.kind === 'examples' ? (
                    <>
                      <ExamplesBody module={activeModule} />
                      <SeeAlsoFooter module={activeModule} />
                    </>
                  ) : null}

                  {currentPage.kind === 'theoretical' && activeModule.theoreticalExam ? (
                    <TheoreticalExamBlock
                      key={`${activeModule.id}-theory`}
                      moduleId={activeModule.id}
                      exam={activeModule.theoreticalExam}
                      isPassed={isActiveTheoryPassed}
                      onPass={(tries) => markTheoryPassed(activeModule.id, tries)}
                      onRecordAnswers={(attempt, recorded) => {
                        if (!canPersist) return;
                        void saveLearningAnswers(activeModule.id, attempt, recorded).catch(() => {
                          /* best-effort; analytics is forward-only */
                        });
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
                      onPass={() => markPracticalPassed(activeModule.id)}
                    />
                  ) : null}
                </section>

                <button
                  type="button"
                  className="nt-pager__arrow nt-pager__arrow--next"
                  onClick={goNextPage}
                  disabled={nextDisabled}
                  aria-label={nextIsModuleAdvance ? 'Next module' : 'Next section'}
                  title={nextGateTitle}
                >
                  ›
                </button>
              </div>

              <footer className="nt-pager__foot">
                <div className="nt-pager__dots" aria-label="Section progress">
                  {pages.map((p, i) => (
                    <button
                      key={p.kind}
                      type="button"
                      className="nt-pager__dot"
                      data-active={i === safePage ? 'true' : undefined}
                      aria-label={`Go to ${p.label}`}
                      title={p.label}
                      onClick={() => setPageIndex(i)}
                    />
                  ))}
                  <span className="nt-pager__counter">
                    {currentPage.label} · step {safePage + 1} of {pages.length}
                  </span>
                </div>

                <div className="nt-pager__foot-actions">
                  <button
                    type="button"
                    className="nt-lesson-button nt-pager__catalog"
                    onClick={() => navigate('/patterns')}
                  >
                    ← Catalog
                  </button>
                  {/* Prev mirror — hidden on desktop (the side ‹ arrow owns it),
                      shown on mobile where the side arrows are removed. */}
                  <button
                    type="button"
                    className="nt-lesson-button nt-pager__foot-prev"
                    onClick={goPrevPage}
                    disabled={prevDisabled}
                    aria-label={atFirstPage ? 'Previous module' : 'Previous section'}
                  >
                    ‹ Prev
                  </button>
                  <button
                    type="button"
                    className="nt-lesson-button nt-lesson-button--primary"
                    onClick={goNextPage}
                    disabled={nextDisabled}
                    title={nextGateTitle}
                  >
                    {nextLabel}
                  </button>
                </div>
              </footer>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
