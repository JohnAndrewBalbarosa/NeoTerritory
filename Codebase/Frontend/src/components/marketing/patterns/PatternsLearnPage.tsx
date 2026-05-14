import { useCallback, useEffect, useMemo, useState } from 'react';
import { learnModuleSlugFromPath, navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  findLearningModule,
  modulesInCategory,
  type LearningCategory,
  type LearningModule,
} from '../../../data/learningModules';

// D77 (round 3): linear-path gating. The hub keeps the multi-step
// guided-course UI from round 2 (hero + progress bar, three-section
// sidebar with numbered step buttons + status, lesson panel with
// Previous/Next footer) but each module now unlocks only after the
// previous module is marked read. Module 0 is unlocked from the start;
// module N is unlocked iff module N-1 is in readIds.
//
// Other rules:
//   - Data source is LEARNING_MODULES (Foundations + 4 pattern families),
//     so the catalog and the learning surface share one source of truth.
//   - URL syncs to /patterns/learn/<module-id> for the active step; a
//     deep link to a locked module bounces to the highest unlocked step.
//   - "Mark read" is per-tab (in-memory). Closing the tab clears progress
//     and re-locks every module past the first.

interface CourseStep {
  module: LearningModule;
  category: LearningCategory;
  globalIndex: number;
}

interface CategoryGroup {
  meta: (typeof CATEGORY_META)[number];
  steps: ReadonlyArray<CourseStep>;
}

function buildCategoryGroups(): {
  groups: ReadonlyArray<CategoryGroup>;
  steps: ReadonlyArray<CourseStep>;
} {
  const steps: CourseStep[] = [];
  const groups: CategoryGroup[] = [];
  CATEGORY_META.forEach((meta) => {
    const inCat = modulesInCategory(meta.id);
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
// once module N-1 has been marked read.
function computeUnlockedCount(
  steps: ReadonlyArray<CourseStep>,
  readIds: ReadonlySet<string>,
): number {
  let n = 1;
  for (let i = 0; i < steps.length - 1; i++) {
    if (readIds.has(steps[i].module.id)) n++;
    else break;
  }
  return Math.min(n, Math.max(steps.length, 1));
}

function clampToUnlocked(idx: number, unlockedCount: number): number {
  if (idx < 0) return 0;
  if (idx >= unlockedCount) return Math.max(0, unlockedCount - 1);
  return idx;
}

// ----- step button + section wrappers (matches old StudentLearningHub CSS) -----

interface StepButtonProps {
  step: CourseStep;
  activeIndex: number;
  isRead: boolean;
  isLocked: boolean;
  onClick: () => void;
}

function StepButton({ step, activeIndex, isRead, isLocked, onClick }: StepButtonProps): JSX.Element {
  const isActive = step.globalIndex === activeIndex;
  const status = isLocked ? 'Locked' : isRead ? 'Done' : isActive ? 'Current' : 'Ready';
  const numberLabel = isLocked ? '\u{1F512}' : isRead ? 'ok' : String(step.globalIndex + 1);
  return (
    <li>
      <button
        type="button"
        data-active={isActive ? 'true' : undefined}
        data-completed={isRead ? 'true' : undefined}
        data-locked={isLocked ? 'true' : undefined}
        disabled={isLocked}
        aria-disabled={isLocked || undefined}
        title={isLocked ? 'Finish the previous module to unlock this one.' : undefined}
        onClick={onClick}
      >
        <span className="nt-course-outline__dot" aria-hidden="true">
          {numberLabel}
        </span>
        <span>
          <small>
            {step.module.eyebrow} · {status}
          </small>
          {step.module.title}
        </span>
      </button>
    </li>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps): JSX.Element {
  return (
    <div className="nt-course-section">
      <p className="nt-course-section__label">{label}</p>
      {children}
    </div>
  );
}

// ----- lesson body renderer: one module in isolation -----

function ModuleBody({ module }: { module: LearningModule }): JSX.Element {
  return (
    <article className="nt-learn__module" aria-labelledby={`mod-${module.id}-title`}>
      <header className="nt-learn__module-head">
        <p className="nt-section-eyebrow">{module.eyebrow}</p>
        <h2 id={`mod-${module.id}-title`} className="nt-learn__module-title">
          {module.title}
        </h2>
        <p className="nt-learn__module-intro">{module.intro}</p>
      </header>

      {module.sections.map((s, idx) => (
        <section className="nt-learn__module-section" key={`${module.id}-s-${idx}`}>
          <h3 className="nt-learn__module-section-head">{s.heading}</h3>
          {s.body ? <p className="nt-learn__module-section-body">{s.body}</p> : null}
          {s.bullets && s.bullets.length > 0 ? (
            <ul className="nt-learn__module-bullets">
              {s.bullets.map((b, i) => (
                <li key={`${module.id}-s-${idx}-b-${i}`}>{b}</li>
              ))}
            </ul>
          ) : null}
          {s.code ? (
            <pre className="nt-learn__module-code" aria-label="Code example">
              {s.code}
            </pre>
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

      {module.seeAlso && module.seeAlso.length > 0 ? (
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
      ) : null}
    </article>
  );
}

// ----- page -----

export default function PatternsLearnPage(): JSX.Element {
  const { groups, steps } = useMemo(() => buildCategoryGroups(), []);

  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const unlockedCount = useMemo(() => computeUnlockedCount(steps, readIds), [steps, readIds]);

  const [activeIndex, setActiveIndex] = useState<number>(() =>
    clampToUnlocked(indexFromUrl(steps), 1),
  );

  // Keep activeIndex synced when the URL changes (back button, deep links,
  // see-also click). Clamp to unlockedCount so a deep link to a locked
  // module bounces to the highest unlocked step instead of slipping past
  // the gate.
  useEffect(() => {
    function recompute(): void {
      setActiveIndex(clampToUnlocked(indexFromUrl(steps), unlockedCount));
    }
    window.addEventListener('popstate', recompute);
    window.addEventListener('nt:navigate', recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener('nt:navigate', recompute);
    };
  }, [steps, unlockedCount]);

  // If unlockedCount shrinks (shouldn't normally — readIds only grows in
  // this tab — but kept as a safety net) or the URL points past the gate,
  // rewrite the URL back to the clamped step so the address bar can't
  // outpace the unlock state.
  useEffect(() => {
    if (steps.length === 0) return;
    const fromUrl = indexFromUrl(steps);
    const clamped = clampToUnlocked(fromUrl, unlockedCount);
    if (clamped !== fromUrl) {
      navigate(`/patterns/learn/${steps[clamped].module.id}`);
      setActiveIndex(clamped);
    }
  }, [steps, unlockedCount]);

  const activeStep = steps[activeIndex];
  const activeModule: LearningModule | undefined = activeStep
    ? findLearningModule(activeStep.module.id)
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

  const markRead = useCallback(() => {
    if (!activeStep) return;
    setReadIds((prev) => {
      if (prev.has(activeStep.module.id)) return prev;
      const next = new Set(prev);
      next.add(activeStep.module.id);
      return next;
    });
  }, [activeStep]);

  const markReadAndAdvance = useCallback(() => {
    markRead();
    if (activeIndex < steps.length - 1) {
      goToStep(activeIndex + 1);
    }
  }, [activeIndex, goToStep, markRead, steps.length]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) goToStep(activeIndex - 1);
  }, [activeIndex, goToStep]);

  const readCount = readIds.size;
  const total = steps.length;
  const progress = total > 0 ? Math.round((readCount / total) * 100) : 0;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === total - 1;
  const isActiveRead = !!(activeStep && readIds.has(activeStep.module.id));

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
            Finish a module to unlock the next — Foundations first, then Creational, Structural,
            Behavioural, and Idioms.
          </p>
          <p className="nt-course-hero__audience">
            Each module ends with a Summary, a Sources list, and a See-also footer. Use
            &ldquo;Next&rdquo; to mark the current module read and unlock the one after it.
            Progress is tracked on this device only.
          </p>
        </div>
        <div className="nt-course-progress" aria-label={`Read progress ${progress}%`}>
          <span>{progress}%</span>
          <p>
            {readCount}/{total} modules read
          </p>
          <div className="nt-course-progress__bar" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="nt-course-shell" aria-label="Learning path">
        <aside className="nt-course-sidebar" aria-label="Learning module outline">
          <div className="nt-course-sidebar__head">
            <p>Modules</p>
            <span>
              {activeIndex + 1}/{total}
            </span>
          </div>

          {groups.map((g, idx) => (
            <Section key={g.meta.id} label={`Section ${idx + 1} · ${g.meta.name}`}>
              <ol className="nt-course-outline">
                {g.steps.map((step) => (
                  <StepButton
                    key={step.module.id}
                    step={step}
                    activeIndex={activeIndex}
                    isRead={readIds.has(step.module.id)}
                    isLocked={step.globalIndex >= unlockedCount}
                    onClick={() => goToStep(step.globalIndex)}
                  />
                ))}
              </ol>
            </Section>
          ))}
        </aside>

        <article className="nt-lesson-panel">
          {activeModule ? <ModuleBody module={activeModule} /> : null}

          <footer className="nt-lesson-controls">
            <button
              type="button"
              className="nt-lesson-button"
              disabled={isFirst}
              onClick={goPrev}
            >
              Previous
            </button>

            <button
              type="button"
              className="nt-lesson-button nt-lesson-button--primary"
              onClick={isLast ? markRead : markReadAndAdvance}
            >
              {isActiveRead
                ? isLast
                  ? 'Marked read'
                  : 'Next module'
                : isLast
                  ? 'Mark as read'
                  : 'Next'}
            </button>

            <button
              type="button"
              className="nt-lesson-button"
              onClick={() => navigate('/patterns')}
            >
              ← Back to catalog
            </button>
          </footer>
        </article>
      </section>
    </main>
  );
}
