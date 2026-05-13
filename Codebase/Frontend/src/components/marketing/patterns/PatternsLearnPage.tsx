import { useCallback, useEffect, useMemo, useState } from 'react';
import { learnModuleSlugFromPath, navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  findLearningModule,
  modulesInCategory,
  type LearningCategory,
  type LearningModule,
} from '../../../data/learningModules';

// D77 (round 2): user feedback — restore the multi-step guided-course UI
// from the legacy StudentLearningHub (hero + progress bar, three-section
// sidebar with numbered step buttons + status, lesson panel with
// Previous/Next/Mark-read footer). Keep the data-silo rules from round 1
// (one module on screen at a time, citations + summary + read-only
// "See also" pointer footer).
//
// Differences from the legacy hub:
//   - Data source is LEARNING_MODULES (Foundations + 4 pattern families)
//     instead of INTRO_LESSONS + PATTERN_STEPS, so the catalog and the
//     learning surface share one source of truth.
//   - No sequential gating. Every step is reachable at any time —
//     "data silo" means the modules don't depend on each other, so
//     forcing a linear order would contradict the rule. Progress reflects
//     "marked read" only, never "unlocked".
//   - URL syncs to /patterns/learn/<module-id> for the active step.
//   - "Mark read" is per-tab (in-memory). Closing the tab clears progress.

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

// ----- step button + section wrappers (matches old StudentLearningHub CSS) -----

interface StepButtonProps {
  step: CourseStep;
  activeIndex: number;
  isRead: boolean;
  onClick: () => void;
}

function StepButton({ step, activeIndex, isRead, onClick }: StepButtonProps): JSX.Element {
  const isActive = step.globalIndex === activeIndex;
  const status = isRead ? 'Done' : isActive ? 'Current' : 'Ready';
  const numberLabel = isRead ? 'ok' : String(step.globalIndex + 1);
  return (
    <li>
      <button
        type="button"
        data-active={isActive ? 'true' : undefined}
        data-completed={isRead ? 'true' : undefined}
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

  const [activeIndex, setActiveIndex] = useState<number>(() => indexFromUrl(steps));
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  // Keep activeIndex synced when the URL changes (back button, deep links,
  // see-also click).
  useEffect(() => {
    function recompute(): void {
      setActiveIndex(indexFromUrl(steps));
    }
    window.addEventListener('popstate', recompute);
    window.addEventListener('nt:navigate', recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener('nt:navigate', recompute);
    };
  }, [steps]);

  const activeStep = steps[activeIndex];
  const activeModule: LearningModule | undefined = activeStep
    ? findLearningModule(activeStep.module.id)
    : undefined;

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      const target = steps[index];
      navigate(`/patterns/learn/${target.module.id}`);
      setActiveIndex(index);
    },
    [steps],
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
            {total} silo&rsquo;d modules across Foundations and the four pattern families. Every
            module reads end-to-end without depending on the others — jump anywhere.
          </p>
          <p className="nt-course-hero__audience">
            Reading the lessons is free. Each module ends with a Summary box, a Sources list, and a
            See-also footer of related modules. Use the &ldquo;Mark as read&rdquo; button to track
            your progress on this device.
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
                  : 'Mark as read & next'}
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
