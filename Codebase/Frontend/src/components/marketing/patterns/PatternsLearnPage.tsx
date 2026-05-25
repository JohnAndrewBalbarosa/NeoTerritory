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
import {
  submitAnalysis,
  fetchLearningProgress,
  saveLearningProgress,
} from '../../../api/client';
import { useAppStore } from '../../../store/appState';
import { PATTERN_BOOK_CITATION, WHY_GOF_EXPLAINER } from './patternData';

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

// ----- prerequisite banner: what unlocked THIS module, what's needed for the NEXT -----

interface PrerequisiteBannerProps {
  steps: ReadonlyArray<CourseStep>;
  activeIndex: number;
  isActiveComplete: boolean;
}

function describePractical(module: LearningModule | undefined): string {
  if (!module || !module.practical) return 'No practical configured for this module — advance via the footer when ready.';
  if (module.practical.kind === 'quiz') {
    return 'A one-question multiple-choice quiz (Check your understanding) on this page.';
  }
  return `A code-submission check against the live analyser. Target pattern: ${module.practical.patternName}. Submit a small C++ class that the analyser tags as ${module.practical.patternName}.`;
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
                ? <>Previous module &ldquo;<strong>{prev.module.title}</strong>&rdquo; practical must be passed. ✓ Passed.</>
                : 'Always unlocked.'}
          </dd>
        </div>

        <div className="nt-lesson-prereq__row">
          <dt>To complete this module</dt>
          <dd>{describePractical(active.module)}</dd>
        </div>

        <div className="nt-lesson-prereq__row" data-state={isActiveComplete ? 'done' : 'pending'}>
          <dt>Status of this module</dt>
          <dd>
            {isActiveComplete
              ? '✓ Practical passed — Next is unlocked.'
              : active.module.practical
                ? 'Pending — scroll down to the practical block to attempt it.'
                : 'No practical configured; use the Next button to advance.'}
          </dd>
        </div>

        <div className="nt-lesson-prereq__row">
          <dt>To unlock the next module</dt>
          <dd>
            {next
              ? <>Pass the practical for this module to unlock &ldquo;<strong>{next.module.title}</strong>&rdquo;.</>
              : 'This is the final module of the path — no further unlock.'}
          </dd>
        </div>
      </dl>
    </aside>
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
  onPass: (tries: number) => void;
}

function QuizPractical({
  practical, isPassed, onPass,
}: { practical: LearningQuizPractical; isPassed: boolean; onPass: (tries: number) => void }): JSX.Element {
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(isPassed);
  // Attempt counter — how many times the learner submitted before passing.
  // Surfaced to the learner and (Phase 3) forwarded to analytics as a proxy
  // for difficulty / mastery on this practical.
  const [tries, setTries] = useState<number>(0);

  const correct = submitted && picked === practical.correctIndex;
  const wrong = submitted && picked !== null && picked !== practical.correctIndex;

  function handleSubmit(): void {
    if (picked === null) return;
    const attempt = tries + 1;
    setTries(attempt);
    setSubmitted(true);
    if (picked === practical.correctIndex) onPass(attempt);
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
            {tries > 0 && <span className="nt-practical__tries"> · {tries} attempt{tries === 1 ? '' : 's'}</span>}
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
}: { practical: LearningPatternPractical; isPassed: boolean; onPass: (tries: number) => void }): JSX.Element {
  const starter = useMemo(
    () =>
      practical.starterCode ??
      `// Write a C++ class that demonstrates the ${practical.patternName} pattern.\n// The check passes when the analyser's tags include "${practical.patternName}".\n\n`,
    [practical.patternName, practical.starterCode],
  );
  const [code, setCode] = useState<string>(starter);
  const [status, setStatus] = useState<'idle' | 'running' | 'pass' | 'fail' | 'error'>(
    isPassed ? 'pass' : 'idle',
  );
  const [tags, setTags] = useState<ReadonlyArray<{ patternId: string; patternName: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Attempt counter for the code-creation exam — counts each analyser run
  // that actually executed (not editor edits). Forwarded to onPass so the
  // module records how many tries the learner needed to trigger the pattern.
  const [tries, setTries] = useState<number>(0);

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
    const attempt = tries + 1;
    setTries(attempt);
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
        onPass(attempt);
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
          {tries > 0 && <span className="nt-practical__tries"> · {tries} attempt{tries === 1 ? '' : 's'}</span>}
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

  const token = useAppStore((s) => s.token);

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  // Attempts the learner needed to pass each module's practical. Surfaced in
  // the UI and persisted alongside progress so analytics can read it.
  const [triesByModule, setTriesByModule] = useState<Record<string, number>>({});

  const unlockedCount = useMemo(
    () => computeUnlockedCount(steps, completedIds),
    [steps, completedIds],
  );

  // Whether the account's progress has been resolved yet. Until it is, we must
  // NOT clamp/bounce the active module to the unlock gate — on a refresh the
  // progress loads async, and clamping against the empty initial set would
  // bounce the user back to module 1 before their real progress arrives.
  // Guests (no token) have nothing to load, so they're "loaded" immediately.
  const [progressLoaded, setProgressLoaded] = useState<boolean>(false);

  // Hydrate progress from the account on mount / sign-in. Progress is stored
  // server-side per user (jwtAuth), so guests keep only the in-memory set for
  // the current visit. Stale ids that no longer match a module are harmless —
  // computeUnlockedCount only counts ids present in `steps`.
  useEffect(() => {
    if (!token) {
      setProgressLoaded(true);
      return;
    }
    let cancelled = false;
    void fetchLearningProgress()
      .then((p) => {
        if (cancelled || !p.completedModuleIds?.length) return;
        setCompletedIds((prev) => {
          const next = new Set(prev);
          for (const id of p.completedModuleIds) next.add(id);
          return next;
        });
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
  }, [token]);

  // Persist the completed set to the account, recording the highest unlocked
  // module id. Fire-and-forget: a failed save never blocks the UI, and the
  // next unlock re-sends the full set so a dropped write self-heals.
  const persistProgress = useCallback(
    (completed: ReadonlySet<string>) => {
      if (!token) return;
      const ids = steps.map((s) => s.module.id).filter((id) => completed.has(id));
      const unlocked = computeUnlockedCount(steps, completed);
      const lastUnlockedModuleId =
        steps.length > 0 ? steps[Math.max(0, Math.min(unlocked, steps.length) - 1)].module.id : null;
      void saveLearningProgress(ids, lastUnlockedModuleId, triesByModule).catch(() => {
        /* best-effort; resent on next unlock */
      });
    },
    [token, steps, triesByModule],
  );

  // Honor the URL module on first render (clamp only to the valid range, not
  // to the unlock gate yet). The bounce-to-gate happens later, once progress
  // has loaded — see the effect below gated on progressLoaded.
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    clampToUnlocked(indexFromUrl(steps), steps.length || 1),
  );

  // The unlock ceiling used by the URL-sync + bounce effects. While progress
  // is still loading we use the full length (no bounce); once loaded we use
  // the real unlock count so locked deep links are clamped.
  const navUnlocked = progressLoaded ? unlockedCount : steps.length || 1;

  // Surface a banner whenever the URL clamp silently redirects the user
  // (deep link / paste of a locked module URL). Without this banner the
  // user sees foundations-module-1 content while the address bar reads
  // /patterns/learn/creational-builder for a fraction of a second, and
  // then the URL flips — they think the system broke or that the
  // foundation quiz IS the Builder practical.
  const [redirectNotice, setRedirectNotice] = useState<{
    requestedTitle: string;
    requestedId: string;
    landedTitle: string;
    requiredCount: number;
  } | null>(null);

  // Keep activeIndex synced when the URL changes (back button, deep links,
  // see-also click). Clamp to unlockedCount so a deep link to a locked
  // module bounces to the highest unlocked step instead of slipping past
  // the gate.
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

  // If unlockedCount shrinks (shouldn't normally — readIds only grows in
  // this tab — but kept as a safety net) or the URL points past the gate,
  // rewrite the URL back to the clamped step so the address bar can't
  // outpace the unlock state. Capture the requested-vs-landed delta into
  // redirectNotice so the article surface can render a visible banner.
  useEffect(() => {
    if (steps.length === 0) return;
    // Wait until the account's progress is known. Bouncing before then would
    // send a refreshing user (whose URL points at a deep, legitimately
    // unlocked module) back to module 1 against the empty initial set.
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

  // Clear the redirect notice the moment the user has unlocked enough
  // modules to reach (or pass) the originally requested one — the banner
  // stops being relevant once the gate they hit no longer applies.
  useEffect(() => {
    if (!redirectNotice) return;
    const requestedIndex = steps.findIndex((s) => s.module.id === redirectNotice.requestedId);
    if (requestedIndex === -1 || requestedIndex < unlockedCount) {
      setRedirectNotice(null);
    }
  }, [redirectNotice, steps, unlockedCount]);

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
    (moduleId: string, tries: number) => {
      // Record the attempt count (keep the first/lowest if re-passed) for the
      // module's practical. Phase 3 forwards this to the analytics endpoint.
      setTriesByModule((prev) =>
        prev[moduleId] != null ? prev : { ...prev, [moduleId]: tries },
      );
      setCompletedIds((prev) => {
        if (prev.has(moduleId)) return prev;
        const next = new Set(prev);
        next.add(moduleId);
        // Completing a module unlocks the next one — persist the new state to
        // the account so progress survives refresh / device change.
        persistProgress(next);
        return next;
      });
    },
    [persistProgress],
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

  // Collapsible module outline. Defaults open on wide viewports; the learner
  // can fold it away to give the lesson body the full width (the path is long,
  // and on a focused read the outline is noise). State is view-only — no need
  // to persist a chrome preference server-side.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const completedCount = completedIds.size;
  const total = steps.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  // Total practical attempts across passed modules — a lightweight effort
  // signal shown beside the progress bar (and persisted to analytics in
  // Phase 3). Reads the per-module attempt map captured on each pass.
  const totalTries = Object.values(triesByModule).reduce((a, b) => a + b, 0);
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
            {totalTries > 0 ? ` · ${totalTries} total attempt${totalTries === 1 ? '' : 's'}` : ''}
          </p>
          <div className="nt-course-progress__bar" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section
        className="nt-course-shell"
        data-sidebar={sidebarOpen ? 'open' : 'collapsed'}
        aria-label="Learning path"
      >
        <aside
          className="nt-course-sidebar"
          aria-label="Learning module outline"
          data-collapsed={sidebarOpen ? undefined : 'true'}
        >
          <div className="nt-course-sidebar__head">
            <button
              type="button"
              className="nt-course-sidebar__toggle"
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Collapse module outline' : 'Expand module outline'}
              title={sidebarOpen ? 'Collapse module outline' : 'Expand module outline'}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? '⟨' : '☰'}
            </button>
            <p>Modules</p>
            <span>
              {activeIndex + 1}/{total}
            </span>
          </div>

          {sidebarOpen && groups.map((g, idx) => (
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
          {redirectNotice ? (
            <aside
              className="nt-lesson-redirect-notice"
              role="status"
              aria-live="polite"
            >
              <div className="nt-lesson-redirect-notice__body">
                <p className="nt-lesson-redirect-notice__title">
                  &ldquo;{redirectNotice.requestedTitle}&rdquo; is locked
                </p>
                <p className="nt-lesson-redirect-notice__detail">
                  Finish {redirectNotice.requiredCount}{' '}
                  more module{redirectNotice.requiredCount === 1 ? '' : 's'} to unlock it.
                  You&rsquo;re now on &ldquo;{redirectNotice.landedTitle}&rdquo; — pass its
                  practical to keep moving forward.
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

          <PrerequisiteBanner
            steps={steps}
            activeIndex={activeIndex}
            isActiveComplete={isActiveComplete}
          />

          {activeModule ? <ModuleBody module={activeModule} /> : null}

          {activeModule && activeModule.practical ? (
            <ModulePractical
              key={activeModule.id}
              module={activeModule}
              isPassed={isActiveComplete}
              onPass={(tries) => markComplete(activeModule.id, tries)}
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

      {/* Reference & context — moved here from the Pattern Catalog so the
          citation and the GoF-anchoring rationale live alongside the
          lessons. These are read-only context cards at the foot of the
          Learning Path. */}
      <section className="nt-learn-reference" aria-labelledby="learn-reference-heading">
        <p className="nt-section-eyebrow" id="learn-reference-heading">
          Reference &amp; context
        </p>

        <div className="nt-learn-reference__cards">
          <article className="nt-patterns__source" aria-labelledby="learn-source">
            <p className="nt-section-eyebrow">Source &amp; framing</p>
            <h2 id="learn-source" className="nt-patterns__source-title">
              Definitions come from Nesteruk 2022 and Gamma et al. 1994
            </h2>
            <p className="nt-patterns__source-body">
              The intent, problem, solution, and idiomatic implementation for every pattern in the
              catalog are paraphrased from {PATTERN_BOOK_CITATION} and cross-checked against the
              original Gang of Four reference. Every pattern detail page lists its sources
              explicitly.
            </p>
            <p className="nt-patterns__source-body">
              Nesteruk&rsquo;s framing is straightforward: a design pattern is a named, idiomatic
              arrangement of classes and operations that solves a recurring object-oriented design
              problem. The same problem keeps appearing because the underlying language facts
              (inheritance, ownership, virtual dispatch) keep producing the same shapes. Giving each
              shape a name turns a paragraph of structural explanation into one word a reviewer can
              look up. That is the entire pitch of design patterns - shared vocabulary that
              compresses architecture into a few familiar shapes.
            </p>
          </article>

          <article className="nt-patterns__source" aria-labelledby="learn-why-gof">
            <p className="nt-section-eyebrow">Why GoF</p>
            <h2 id="learn-why-gof" className="nt-patterns__source-title">
              Why the catalog is Gang-of-Four anchored
            </h2>
            <p className="nt-patterns__source-body">{WHY_GOF_EXPLAINER}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
