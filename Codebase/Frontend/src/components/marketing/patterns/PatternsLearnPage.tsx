import { useCallback, useEffect, useMemo, useState } from 'react';
import { learnModuleSlugFromPath, navigate } from '../../../logic/router';
import {
  CATEGORY_META,
  findLearningModule,
  modulesInCategory,
  type LearningCategory,
  type LearningModule,
  type LearningPatternPractical,
  type LearningQuizPractical,
} from '../../../data/learningModules';
import { submitAnalysis } from '../../../api/client';

// D77 (round 4): per-module practical check is the unlock gate. The hub
// keeps the multi-step guided-course UI (hero + progress, three-section
// sidebar, lesson panel with Previous/Next footer) from earlier rounds,
// but module N now unlocks only after module N-1's practical passes —
// either a multiple-choice quiz (Foundations) or a /api/analyze code
// submission whose detected tags include the target pattern (Creational,
// Structural, Behavioural, Idioms).
//
// Other rules:
//   - Data source is LEARNING_MODULES (Foundations + 4 pattern families).
//   - URL syncs to /patterns/learn/<module-id>; a deep link to a locked
//     module bounces to the highest unlocked step.
//   - "Completed" is per-tab (in-memory). Closing the tab re-locks
//     everything past module 0. Pattern practicals require the user to
//     be signed in because /api/analyze is jwtAuth-gated.

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
// once module N-1's practical has been passed (or, for the rare module
// without a practical, marked complete via the footer).
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

// Mirror of backend services/candidateFilter.ts#normalize. Lowercase,
// strip "<family>." prefix, drop non-alphanum so the microservice's
// "creational.singleton" matches the practical's slug "singleton" or
// its display name "Singleton".
function normalizePatternKey(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().trim().replace(/^[a-z]+\./, '').replace(/[^a-z0-9]/g, '');
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

// ----- per-module practical: quiz OR code-check -----

interface ModulePracticalProps {
  module: LearningModule;
  isPassed: boolean;
  onPass: () => void;
}

function QuizPractical({
  practical, isPassed, onPass,
}: { practical: LearningQuizPractical; isPassed: boolean; onPass: () => void }): JSX.Element {
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(isPassed);

  const correct = submitted && picked === practical.correctIndex;
  const wrong = submitted && picked !== null && picked !== practical.correctIndex;

  function handleSubmit(): void {
    if (picked === null) return;
    setSubmitted(true);
    if (picked === practical.correctIndex) onPass();
  }

  function handleRetry(): void {
    setSubmitted(false);
    setPicked(null);
  }

  return (
    <section className="nt-practical nt-practical--quiz" aria-label="Module practical">
      <header className="nt-practical__head">
        <p className="nt-practical__eyebrow">Practical · Check your understanding</p>
        <h3 className="nt-practical__title">{practical.question}</h3>
      </header>
      <ol className="nt-practical__choices">
        {practical.options.map((opt, i) => {
          const isPickedRow = picked === i;
          const isCorrectRow = submitted && i === practical.correctIndex;
          const isWrongPick = submitted && isPickedRow && i !== practical.correctIndex;
          return (
            <li key={i}>
              <label
                className="nt-practical__choice"
                data-picked={isPickedRow ? 'true' : undefined}
                data-correct={isCorrectRow ? 'true' : undefined}
                data-wrong={isWrongPick ? 'true' : undefined}
              >
                <input
                  type="radio"
                  name={`quiz-${practical.question.slice(0, 24)}`}
                  checked={isPickedRow}
                  disabled={submitted && correct}
                  onChange={() => setPicked(i)}
                />
                <span>{opt}</span>
              </label>
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
            disabled={picked === null}
          >
            Submit answer
          </button>
        )}
        {submitted && correct && (
          <p className="nt-practical__verdict nt-practical__verdict--pass" role="status">
            ✓ Correct. {practical.explanation || 'Module unlocked.'}
          </p>
        )}
        {submitted && wrong && (
          <>
            <p className="nt-practical__verdict nt-practical__verdict--fail" role="status">
              ✗ Not quite. {practical.explanation || 'Re-read the section above and try again.'}
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

function PatternPractical({
  practical, isPassed, onPass,
}: { practical: LearningPatternPractical; isPassed: boolean; onPass: () => void }): JSX.Element {
  const starter = useMemo(
    () => `// Write a C++ class that demonstrates the ${practical.patternName} pattern.\n// The check passes when the analyser's tags include "${practical.patternName}".\n\n`,
    [practical.patternName],
  );
  const [code, setCode] = useState<string>(starter);
  const [status, setStatus] = useState<'idle' | 'running' | 'pass' | 'fail' | 'error'>(
    isPassed ? 'pass' : 'idle',
  );
  const [tags, setTags] = useState<ReadonlyArray<{ patternId: string; patternName: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const targetKey = normalizePatternKey(practical.patternSlug);
  const targetNameKey = normalizePatternKey(practical.patternName);

  async function handleRun(): Promise<void> {
    if (!code.trim()) {
      setStatus('error');
      setErrorMsg('Write a C++ class first, then run the check.');
      return;
    }
    setStatus('running');
    setErrorMsg('');
    setTags([]);
    try {
      const run = await submitAnalysis(JSON.stringify({
        code,
        filename: `${practical.patternSlug}-submission.cpp`,
      }));
      const detected = (run.detectedPatterns || []).map((p) => ({
        patternId: p.patternId,
        patternName: p.patternName || p.patternId,
      }));
      setTags(detected);
      const hit = detected.some((p) => {
        const idKey = normalizePatternKey(p.patternId);
        const nameKey = normalizePatternKey(p.patternName);
        return idKey === targetKey || idKey === targetNameKey
            || nameKey === targetKey || nameKey === targetNameKey;
      });
      if (hit) {
        setStatus('pass');
        onPass();
      } else {
        setStatus('fail');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed.');
    }
  }

  function handleReset(): void {
    setCode(starter);
    setStatus('idle');
    setTags([]);
    setErrorMsg('');
  }

  return (
    <section className="nt-practical nt-practical--pattern" aria-label="Module practical">
      <header className="nt-practical__head">
        <p className="nt-practical__eyebrow">Practical · Trigger the analyser</p>
        <h3 className="nt-practical__title">
          Target pattern: <span className="nt-practical__target">{practical.patternName}</span>
        </h3>
        <p className="nt-practical__prompt">{practical.prompt}</p>
      </header>
      <textarea
        className="nt-practical__editor"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={14}
        aria-label="C++ source for the practical check"
        disabled={status === 'running'}
      />
      <div className="nt-practical__footer">
        <button
          type="button"
          className="nt-lesson-button nt-lesson-button--primary"
          onClick={handleRun}
          disabled={status === 'running'}
        >
          {status === 'running' ? 'Running…' : status === 'pass' ? 'Re-run check' : 'Run check'}
        </button>
        <button
          type="button"
          className="nt-lesson-button"
          onClick={handleReset}
          disabled={status === 'running'}
        >
          Reset
        </button>
      </div>
      {status === 'pass' && (
        <p className="nt-practical__verdict nt-practical__verdict--pass" role="status">
          ✓ Pass — the analyser tagged your class as <strong>{practical.patternName}</strong>
          {tags.length > 1 ? ` (alongside ${tags.length - 1} other tag${tags.length - 1 === 1 ? '' : 's'} — ambiguity is fine)` : ''}
          .
        </p>
      )}
      {status === 'fail' && (
        <div className="nt-practical__verdict nt-practical__verdict--fail" role="status">
          <p>
            ✗ <strong>{practical.patternName}</strong> was not detected.
            {tags.length > 0
              ? ' Detected tags: '
              : ' The analyser returned no pattern tags for your submission.'}
          </p>
          {tags.length > 0 && (
            <ul className="nt-practical__tags">
              {tags.map((t, i) => (
                <li key={`${t.patternId}-${i}`}>
                  <code>{t.patternName || t.patternId}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {status === 'error' && (
        <p className="nt-practical__verdict nt-practical__verdict--fail" role="status">
          {errorMsg || 'Analyser unavailable. Sign in (Google) and try again — /api/analyze requires authentication.'}
        </p>
      )}
    </section>
  );
}

function ModulePractical({ module, isPassed, onPass }: ModulePracticalProps): JSX.Element | null {
  const p = module.practical;
  if (!p) return null;
  if (p.kind === 'quiz') return <QuizPractical practical={p} isPassed={isPassed} onPass={onPass} />;
  return <PatternPractical practical={p} isPassed={isPassed} onPass={onPass} />;
}

// ----- page -----

export default function PatternsLearnPage(): JSX.Element {
  const { groups, steps } = useMemo(() => buildCategoryGroups(), []);

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const unlockedCount = useMemo(
    () => computeUnlockedCount(steps, completedIds),
    [steps, completedIds],
  );

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

  const markComplete = useCallback(
    (moduleId: string) => {
      setCompletedIds((prev) => {
        if (prev.has(moduleId)) return prev;
        const next = new Set(prev);
        next.add(moduleId);
        return next;
      });
    },
    [],
  );

  const goPrev = useCallback(() => {
    if (activeIndex > 0) goToStep(activeIndex - 1);
  }, [activeIndex, goToStep]);

  const goNext = useCallback(() => {
    // Advance only when the current module is complete; the footer button
    // is disabled otherwise so this is a defence-in-depth check.
    if (!activeStep || !completedIds.has(activeStep.module.id)) return;
    if (activeIndex < steps.length - 1) goToStep(activeIndex + 1);
  }, [activeIndex, activeStep, completedIds, goToStep, steps.length]);

  const completedCount = completedIds.size;
  const total = steps.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === total - 1;
  const isActiveComplete = !!(activeStep && completedIds.has(activeStep.module.id));

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
        <div className="nt-course-progress" aria-label={`Practical progress ${progress}%`}>
          <span>{progress}%</span>
          <p>
            {completedCount}/{total} modules passed
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
                    isRead={completedIds.has(step.module.id)}
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

          {activeModule && activeModule.practical ? (
            <ModulePractical
              key={activeModule.id}
              module={activeModule}
              isPassed={isActiveComplete}
              onPass={() => markComplete(activeModule.id)}
            />
          ) : null}

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
              onClick={isLast ? undefined : goNext}
              disabled={!isActiveComplete || isLast}
              title={
                !isActiveComplete
                  ? 'Pass the practical above to unlock the next module.'
                  : isLast
                  ? 'You finished the last module.'
                  : undefined
              }
            >
              {isLast
                ? isActiveComplete
                  ? 'Path complete'
                  : 'Finish the practical'
                : isActiveComplete
                ? 'Next module'
                : 'Locked'}
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
