import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { navigate } from '../../logic/router';
import { CATEGORY_META } from '../../data/learningModules';
import { useLearningModules } from '../../data/useLearningModules';
import {
  fetchLearningAssessments,
  fetchLearningProgress,
  type LearningProgress,
} from '../../api/client';
import { useAppStore } from '../../store/appState';
import { deriveInternLearningStatus } from '../../logic/internLearningStatus';
import {
  getPostTestEligibility,
  resolvePostTestCycleId,
  pairedLearningGain,
} from '../../logic/postTestEligibility';
import type { LearningAssessmentsResponse } from '../../types/api';

function readUnlockAllOverride(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('nt_learning_unlock_all') === '1';
  } catch {
    return false;
  }
}

function completionRatio(done: number, total: number): number {
  return total > 0 ? done / total : 0;
}

export default function InternDashboard(): JSX.Element {
  const token = useAppStore((s) => s.token);
  const unlockAll = useMemo(() => readUnlockAllOverride(), []);
  const { modules, loaded } = useLearningModules();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [assessments, setAssessments] = useState<LearningAssessmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/student-learning/login');
      return;
    }

    if (!loaded) return;

    let cancelled = false;

    if (unlockAll) {
      const moduleIds = modules.map((module) => module.id);
      setProgress({
        completedModuleIds: moduleIds,
        lastUnlockedModuleId: moduleIds[moduleIds.length - 1] ?? null,
        theoryPassedModuleIds: moduleIds,
      });
      setAssessments({ attempts: [], answers: [] });
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      fetchLearningProgress(),
      fetchLearningAssessments(),
    ])
      .then(([progressData, assessmentData]) => {
        if (!cancelled) {
          setProgress(progressData);
          setAssessments(assessmentData);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load learner progress');
      });

    return () => {
      cancelled = true;
    };
  }, [loaded, modules, token, unlockAll]);

  if (!token) {
    return (
      <main style={styles.shell}>
        <section style={styles.hero}>
          <p style={styles.kicker}>Intern Dashboard</p>
          <h1 style={styles.title}>Redirecting to sign-in</h1>
          <p style={styles.copy}>This dashboard needs a signed-in learner session.</p>
        </section>
      </main>
    );
  }

  if (!loaded || (!unlockAll && (progress === null || assessments === null) && error === null)) {
    return (
      <main style={styles.shell}>
        <section style={styles.hero}>
          <p style={styles.kicker}>Intern Dashboard</p>
          <h1 style={styles.title}>Loading progress</h1>
          <p style={styles.copy}>Reading the learner progress snapshot…</p>
        </section>
      </main>
    );
  }

  if (error && !unlockAll) {
    return (
      <main style={styles.shell}>
        <section style={styles.hero}>
          <p style={styles.kicker}>Intern Dashboard</p>
          <h1 style={styles.title}>Progress unavailable</h1>
          <p style={styles.copy}>{error}</p>
          <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/patterns/learn')}>
            Return to learning
          </button>
        </section>
      </main>
    );
  }

  const progressSnapshot: LearningProgress = progress ?? {
    completedModuleIds: [],
    lastUnlockedModuleId: null,
    theoryPassedModuleIds: [],
  };
  const internStatus = assessments
    ? deriveInternLearningStatus(modules, assessments, progressSnapshot)
    : null;
  // Cycle-scoped Post-Test release state (single source of truth). Re-derived on
  // every render from the freshly-fetched assessments + progress, so completing
  // a required module and returning here flips the card to Available with no
  // manual PM release.
  const postTestCycleId = assessments ? resolvePostTestCycleId(assessments) : null;
  const postTest = assessments
    ? getPostTestEligibility({ modules, assessments, progress: progressSnapshot, cycleId: postTestCycleId })
    : null;
  const postTestGain = assessments && postTest?.status === 'completed' && postTestCycleId
    ? pairedLearningGain(modules, assessments, postTestCycleId)
    : null;
  const postTestDate = assessments && postTest?.postTestAttemptId
    ? assessments.attempts.find((a) => a.id === postTest.postTestAttemptId)?.createdAt ?? null
    : null;
  const moduleIdSet = new Set(modules.map((module) => module.id));
  // Count only ids that are real modules in the current path, so stale/duplicate
  // saved ids can never push a count above the total (no more "39/14").
  const completedSet = new Set(progressSnapshot.completedModuleIds.filter((id) => moduleIdSet.has(id)));
  const skippedSet = new Set((progressSnapshot.skippedModuleIds ?? []).filter((id) => moduleIdSet.has(id)));
  const totalModules = modules.length;
  // Optional modules = a perfect (100%) per-module pre-test score.
  const optionalSet = new Set(
    Object.values(internStatus?.pretestScore?.byModule ?? {})
      .filter((row) => row.percent >= 100)
      .map((row) => row.moduleId),
  );
  const completedCount = unlockAll
    ? totalModules
    : Math.min(modules.filter((module) => completedSet.has(module.id)).length, totalModules);
  const completionPct = Math.min(Math.max(completionRatio(completedCount, totalModules), 0), 1);
  const requiredRemaining = internStatus
    ? Math.max(internStatus.requiredModuleIds.length - internStatus.completedRequiredModuleIds.length, 0)
    : Math.max(totalModules - completedCount, 0);

  // Single, unambiguous status per module (never both Complete and Locked).
  type ModuleStatus = 'Completed' | 'Skipped' | 'In Progress' | 'Optional' | 'Locked';
  let reachedOpenModule = false;
  const moduleStatusById = new Map<string, ModuleStatus>();
  for (const module of modules) {
    let status: ModuleStatus;
    if (unlockAll || completedSet.has(module.id)) {
      status = 'Completed';
    } else if (skippedSet.has(module.id)) {
      status = 'Skipped';
    } else if (!reachedOpenModule) {
      // First not-yet-finished module in path order is the active one.
      status = optionalSet.has(module.id) ? 'Optional' : 'In Progress';
      reachedOpenModule = true;
    } else {
      status = optionalSet.has(module.id) ? 'Optional' : 'Locked';
    }
    moduleStatusById.set(module.id, status);
  }
  const nextModule = modules.find(
    (module) => !completedSet.has(module.id) && !skippedSet.has(module.id) && !optionalSet.has(module.id),
  ) ?? null;
  const nextModuleNumber = nextModule ? modules.findIndex((module) => module.id === nextModule.id) + 1 : 0;

  // Resume hint for "Continue Learning": where the learner last stopped, only
  // when that module still exists and isn't already completed.
  const STAGE_LABEL: Record<string, string> = { lesson: 'Lesson', theoretical: 'Conceptual Assessment', practical: 'Practical Assessment' };
  const resume = progress?.resume ?? null;
  const resumeModule = resume && !completedSet.has(resume.moduleId)
    ? modules.find((m) => m.id === resume.moduleId) ?? null
    : null;
  const resumeLabel = resumeModule
    ? `Resume ${resumeModule.title}${resume?.stage ? ` — ${STAGE_LABEL[resume.stage] ?? resume.stage}` : ''}`
    : null;

  const categoryRows = CATEGORY_META.map((meta) => {
    const inCategory = modules.filter((module) => module.category === meta.id);
    const done = inCategory.filter((module) => completedSet.has(module.id)).length;
    const ratio = Math.min(Math.max(completionRatio(done, inCategory.length), 0), 1);
    return { meta, done, total: inCategory.length, ratio };
  }).filter((row) => row.total > 0);

  const recentModules = modules.slice(Math.max(0, modules.length - 6));

  return (
    <main style={styles.shell}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <p style={styles.kicker}>Intern Dashboard</p>
            <h1 style={styles.title}>Your learning progress</h1>
          </div>
          <div style={styles.badgeRow}>
            <span style={styles.badge}>{completedCount}/{totalModules} complete</span>
          </div>
        </div>
        <p style={styles.copy}>
          Track your pre-test standing, required review modules, completed lessons, and next learning activity.
        </p>

        <div style={styles.actions}>
          {postTest?.status === 'completed' ? (
            <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/studio')}>
              Open Studio
            </button>
          ) : postTest?.status === 'available' ? (
            <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/post-test')}>
              Take Post-Test
            </button>
          ) : postTest?.status === 'in_progress' ? (
            <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/post-test')}>
              Resume Post-Test
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/patterns/learn')}>
                Continue Learning
              </button>
              {resumeLabel ? <span style={styles.resumeHint}>{resumeLabel}</span> : null}
            </div>
          )}
        </div>
      </section>

      <section style={styles.grid}>
        <article style={{ ...styles.card, ...styles.pretestCard }}>
          <p style={styles.cardLabel}>Pre-Test Standing</p>
          <div style={styles.metric}>{internStatus?.pretestScore?.percent ?? 0}%</div>
          <p style={styles.cardCopy}>
            {internStatus?.pretestScore
              ? `${internStatus.pretestScore.correct} of ${internStatus.pretestScore.total} correct · ${internStatus.requiredModuleIds.length} module(s) recommended for review.`
              : 'No saved Pre-Test result yet.'}
          </p>
          {internStatus?.pretestScore ? (
            <button type="button" className="nt-lesson-button" style={{ marginTop: 10 }} onClick={() => navigate('/assessment-results?view=pre')}>
              View Results
            </button>
          ) : null}
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Completed Modules</p>
          <div style={styles.metric}>{completedCount}<span style={styles.metricTotal}> / {totalModules}</span></div>
          <div style={styles.progressShell} aria-hidden="true">
            <div style={{ ...styles.progressFill, width: `${Math.round(completionPct * 100)}%` }} />
          </div>
          <p style={styles.cardCopy}>{Math.round(completionPct * 100)}% of the learning path complete.</p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Required Modules Remaining</p>
          <div style={styles.metric}>{requiredRemaining}</div>
          <p style={styles.cardCopy}>Required review modules left before the Post-Test unlocks.</p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Post-Test Status</p>
          {postTest?.status === 'completed' ? (
            <>
              <div style={styles.metricSmall}>Post-Test Completed</div>
              <p style={styles.cardCopy}>
                Score {postTest.frozenModuleIds.length > 0 ? `${postTestGain?.post.percent ?? internStatus?.posttestScore?.percent ?? 0}%` : '—'}
                {postTestGain ? ` · Pre-Test ${postTestGain.pre.percent}% · ` : ' · '}
                {postTestGain ? (
                  <span data-sign={postTestGain.gain.gainPoints >= 0 ? 'pos' : 'neg'}>
                    Learning gain {postTestGain.gain.gainPoints > 0 ? '+' : ''}{postTestGain.gain.gainPoints} pp
                  </span>
                ) : 'learning gain unavailable'}
                {postTestDate ? ` · ${new Date(postTestDate).toLocaleDateString()}` : ''}
              </p>
              <p style={styles.cardCopy}>
                Score difference within this project-relevant assessment cycle (not a measure of complete professional mastery).
              </p>
              <button type="button" className="nt-lesson-button" style={{ marginTop: 10 }} onClick={() => navigate('/assessment-results?view=post')}>
                View Results
              </button>
            </>
          ) : postTest?.status === 'config_issue' ? (
            <>
              <div style={styles.metricSmall}>Configuration Issue</div>
              <p style={styles.cardCopy}>
                {postTest.reasonMessage}
                {postTest.missingFormBModuleIds.length > 0
                  ? ` Missing Post-Test questions: ${postTest.missingFormBModuleIds.join(', ')}.`
                  : ''}
              </p>
            </>
          ) : postTest?.status === 'available' ? (
            <>
              <div style={styles.metricSmall}>Post-Test Available</div>
              <p style={styles.cardCopy}>
                You completed all required learning activities. Covers {postTest.coveredModuleCount} module{postTest.coveredModuleCount === 1 ? '' : 's'} from your Pre-Test.
              </p>
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" style={{ marginTop: 10 }} onClick={() => navigate('/post-test')}>
                Start Post-Test
              </button>
            </>
          ) : postTest?.status === 'in_progress' ? (
            <>
              <div style={styles.metricSmall}>Post-Test In Progress</div>
              <button type="button" className="nt-lesson-button nt-lesson-button--primary" style={{ marginTop: 10 }} onClick={() => navigate('/post-test')}>
                Resume Post-Test
              </button>
            </>
          ) : (
            <>
              <div style={styles.metricSmall}>Post-Test Locked</div>
              <p style={styles.cardCopy}>
                {postTest && postTest.requiredModuleCount > 0
                  ? `${postTest.completedRequiredModuleCount} of ${postTest.requiredModuleCount} required modules complete. Complete all required modules to unlock the Post-Test.`
                  : 'Complete the Pre-Test and your required modules to unlock the Post-Test.'}
              </p>
              {postTest && postTest.remainingModuleIds.length > 0 ? (
                <p style={styles.cardCopy}>
                  Remaining: {postTest.remainingModuleIds
                    .map((id) => modules.find((m) => m.id === id)?.title ?? id)
                    .join(', ')}
                </p>
              ) : null}
            </>
          )}
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Studio Access</p>
          <div style={styles.metricSmall}>{internStatus?.studioUnlocked ? 'Unlocked' : 'Locked'}</div>
          <p style={styles.cardCopy}>
            {internStatus?.studioUnlocked
              ? 'Studio is available from your completed learning flow.'
              : 'Unlocks after the Pre-Test, required modules, and Post-Test.'}
          </p>
        </article>
      </section>

      <section style={styles.stack}>
        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Strengths and gaps</h2>
          </div>
          {categoryRows.length > 0 ? (
            <div style={styles.categoryGrid}>
              {categoryRows.map((row) => (
                <div key={row.meta.id} style={styles.categoryRow}>
                  <div style={styles.categoryTop}>
                    <strong>{row.meta.name}</strong>
                    <span style={styles.categoryCount}>{row.done}/{row.total}</span>
                  </div>
                  <div style={styles.progressShell}>
                    <div style={{ ...styles.progressFill, width: `${Math.round(row.ratio * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyCopy}>No data yet.</p>
          )}
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Next action</h2>
          </div>
          <div style={styles.nextBox}>
            <p style={styles.nextTitle}>
              {nextModule
                ? `Continue with ${nextModule.eyebrow} · Module ${nextModuleNumber}`
                : 'Required path complete'}
            </p>
            <p style={styles.nextCopy}>
              {nextModule
                ? `Next: ${nextModule.title}. Complete its conceptual assessment with a perfect score to continue.`
                : internStatus?.posttestCompleted
                  ? 'Your required modules and Post-Test are complete — Studio is now available.'
                  : internStatus?.requiredModulesCompleted
                    ? 'All required review modules are done. Take the Post-Test next.'
                    : 'Complete the required review modules before taking the Post-Test.'}
            </p>
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Recent modules</h2>
            <span style={styles.panelMeta}>Latest part of the path</span>
          </div>
          <div style={styles.moduleList}>
            {recentModules.map((module) => {
              const status = moduleStatusById.get(module.id) ?? 'Locked';
              return (
                <div key={module.id} style={styles.moduleRow}>
                  <div style={styles.moduleRowMain}>
                    <p style={styles.moduleEyebrow}>{module.eyebrow}</p>
                    <p style={styles.moduleTitle}>{module.title}</p>
                  </div>
                  <span style={{ ...styles.statusPill, ...(STATUS_PILL_STYLE[status] ?? {}) }}>{status}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}

const STATUS_PILL_STYLE: Record<string, CSSProperties> = {
  Completed: { background: 'rgba(166,255,0,0.12)', color: '#d7ff85' },
  'In Progress': { background: 'rgba(140,184,255,0.16)', color: '#bcd4ff' },
  Optional: { background: 'rgba(255,255,255,0.08)', color: 'rgba(244,247,251,0.82)' },
  Skipped: { background: 'rgba(255,196,84,0.14)', color: '#ffd79a' },
  Locked: { background: 'rgba(255,255,255,0.05)', color: 'rgba(244,247,251,0.55)' },
};

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    padding: '32px clamp(16px, 4vw, 40px) 56px',
    background: 'linear-gradient(180deg, rgba(8,12,22,1) 0%, rgba(13,18,32,1) 100%)',
    color: '#f4f7fb',
  },
  hero: {
    maxWidth: 1180,
    margin: '0 auto 24px',
    padding: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    background: 'rgba(10, 14, 24, 0.78)',
    boxShadow: '0 18px 54px rgba(0,0,0,0.28)',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  kicker: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    color: '#8cb8ff',
    fontSize: 12,
  },
  title: {
    margin: '6px 0 0',
    fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
    lineHeight: 1.1,
  },
  copy: {
    margin: '14px 0 0',
    maxWidth: 760,
    color: 'rgba(244,247,251,0.84)',
  },
  resumeHint: {
    fontSize: 12,
    color: 'rgba(244,247,251,0.7)',
  },
  badgeRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f4f7fb',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  badgeWarn: {
    background: 'rgba(166,255,0,0.12)',
    borderColor: 'rgba(166,255,0,0.28)',
    color: '#d7ff85',
  },
  pretestCard: {
    borderColor: 'rgba(0,209,216,0.3)',
    background: 'linear-gradient(145deg, rgba(0,209,216,0.09), rgba(12,18,30,0.9))',
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  grid: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(12, 18, 30, 0.88)',
  },
  cardLabel: {
    margin: 0,
    color: '#8cb8ff',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: 12,
  },
  metric: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  metricTotal: {
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(244,247,251,0.6)',
  },
  metricSmall: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  categoryCount: {
    color: 'rgba(244,247,251,0.7)',
    fontSize: 13,
  },
  emptyCopy: {
    margin: 0,
    color: 'rgba(244,247,251,0.6)',
  },
  moduleRowMain: {
    minWidth: 0,
  },
  statusPill: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(244,247,251,0.78)',
  },
  cardCopy: {
    margin: '12px 0 0',
    color: 'rgba(244,247,251,0.78)',
  },
  progressShell: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #8cb8ff 0%, #a6ff00 100%)',
  },
  stack: {
    maxWidth: 1180,
    margin: '16px auto 0',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  panel: {
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(12, 18, 30, 0.88)',
  },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'baseline',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  panelTitle: {
    margin: 0,
    fontSize: 20,
  },
  panelMeta: {
    color: 'rgba(244,247,251,0.72)',
    fontSize: 13,
  },
  categoryGrid: {
    display: 'grid',
    gap: 12,
  },
  categoryRow: {
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
  },
  categoryTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  nextBox: {
    padding: 18,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
  },
  nextTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  nextCopy: {
    margin: '8px 0 0',
    color: 'rgba(244,247,251,0.82)',
  },
  nextMeta: {
    margin: '10px 0 0',
    color: '#8cb8ff',
    fontSize: 13,
  },
  moduleList: {
    display: 'grid',
    gap: 10,
  },
  moduleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
  },
  moduleEyebrow: {
    margin: 0,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#8cb8ff',
  },
  moduleTitle: {
    margin: '4px 0 0',
    fontWeight: 600,
  },
  moduleFlags: {
    display: 'grid',
    gap: 6,
    justifyItems: 'end',
  },
  flagDone: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(166,255,0,0.12)',
    color: '#d7ff85',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  flagPending: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(244,247,251,0.74)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
};
