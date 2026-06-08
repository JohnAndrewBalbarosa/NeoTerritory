import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { navigate } from '../../logic/router';
import { CATEGORY_META } from '../../data/learningModules';
import { useLearningModules } from '../../data/useLearningModules';
import { fetchLearningProgress, type LearningProgress } from '../../api/client';
import { useAppStore } from '../../store/appState';

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

export default function StudentDashboard(): JSX.Element {
  const token = useAppStore((s) => s.token);
  const unlockAll = useMemo(() => readUnlockAllOverride(), []);
  const { modules, switchboard, loaded } = useLearningModules();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
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
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    fetchLearningProgress()
      .then((data) => {
        if (!cancelled) setProgress(data);
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
          <p style={styles.kicker}>Student dashboard</p>
          <h1 style={styles.title}>Redirecting to sign-in</h1>
          <p style={styles.copy}>This dashboard needs a signed-in learner session.</p>
        </section>
      </main>
    );
  }

  if (!loaded || (!unlockAll && progress === null && error === null)) {
    return (
      <main style={styles.shell}>
        <section style={styles.hero}>
          <p style={styles.kicker}>Student dashboard</p>
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
          <p style={styles.kicker}>Student dashboard</p>
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
  const completedSet = new Set(progressSnapshot.completedModuleIds);
  const theoryPassedSet = new Set(progressSnapshot.theoryPassedModuleIds ?? []);
  const totalModules = modules.length;
  const visibilityOn = switchboard.filter((row) => row.effectivePublished).length;
  const visibilityOff = Math.max(switchboard.length - visibilityOn, 0);
  const completedCount = unlockAll ? totalModules : completedSet.size;
  const theoryCount = unlockAll ? totalModules : theoryPassedSet.size;
  const remainingCount = Math.max(totalModules - completedCount, 0);
  const completionPct = completionRatio(completedCount, totalModules);
  const nextModule = modules.find((module) => !completedSet.has(module.id)) ?? null;
  const lastUnlocked =
    modules.find((module) => module.id === progressSnapshot.lastUnlockedModuleId) ??
    (completedCount > 0 ? modules[Math.min(completedCount, modules.length) - 1] : null);

  const categoryRows = CATEGORY_META.map((meta) => {
    const inCategory = modules.filter((module) => module.category === meta.id);
    const done = inCategory.filter((module) => completedSet.has(module.id)).length;
    const ratio = completionRatio(done, inCategory.length);
    return { meta, done, total: inCategory.length, ratio };
  });

  const strongest = categoryRows.reduce((best, row) => (row.ratio > best.ratio ? row : best), categoryRows[0] ?? null);
  const weakest = categoryRows.reduce((worst, row) => (row.ratio < worst.ratio ? row : worst), categoryRows[0] ?? null);
  const recentModules = modules.slice(Math.max(0, modules.length - 6));

  return (
    <main style={styles.shell}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <p style={styles.kicker}>Student dashboard</p>
            <h1 style={styles.title}>Your learning progress</h1>
          </div>
          <div style={styles.badgeRow}>
            {unlockAll ? <span style={{ ...styles.badge, ...styles.badgeWarn }}>unlock override</span> : null}
            <span style={styles.badge}>{completedCount}/{totalModules} complete</span>
          </div>
        </div>
        <p style={styles.copy}>
          Canvas-style progress with TOPCIT-like score grouping: clear completion, strong areas, weak areas, and the next thing to finish.
        </p>

        <div style={styles.actions}>
          <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/patterns/learn')}>
            Continue learning
          </button>
          {unlockAll ? (
            <button
              type="button"
              className="nt-lesson-button"
              onClick={() => {
                try {
                  window.localStorage.removeItem('nt_learning_unlock_all');
                } finally {
                  window.location.reload();
                }
              }}
            >
              Disable unlock override
            </button>
          ) : (
            <button
              type="button"
              className="nt-lesson-button"
              onClick={() => {
                try {
                  window.localStorage.setItem('nt_learning_unlock_all', '1');
                } finally {
                  window.location.reload();
                }
              }}
            >
              Enable unlock override
            </button>
          )}
        </div>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Completed modules</p>
          <div style={styles.metric}>{completedCount}</div>
          <p style={styles.cardCopy}>Finished modules in the current learner path.</p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Module visibility</p>
          <div style={styles.metric}>{visibilityOn}/{switchboard.length}</div>
          <p style={styles.cardCopy}>
            {visibilityOff} modules are off in the switchboard and hidden from the learner path.
          </p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Theory passed</p>
          <div style={styles.metric}>{theoryCount}</div>
          <p style={styles.cardCopy}>Modules with theory already cleared.</p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Remaining</p>
          <div style={styles.metric}>{remainingCount}</div>
          <p style={styles.cardCopy}>Modules still left before the path is done.</p>
        </article>
        <article style={styles.card}>
          <p style={styles.cardLabel}>Completion</p>
          <div style={styles.metric}>{Math.round(completionPct * 100)}%</div>
          <div style={styles.progressShell} aria-hidden="true">
            <div style={{ ...styles.progressFill, width: `${Math.round(completionPct * 100)}%` }} />
          </div>
        </article>
      </section>

      <section style={styles.stack}>
        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Strengths and gaps</h2>
            <span style={styles.panelMeta}>
              Strongest: {strongest ? strongest.meta.name : 'n/a'}
            </span>
          </div>
          <div style={styles.categoryGrid}>
            {categoryRows.map((row) => (
              <div key={row.meta.id} style={styles.categoryRow}>
                <div style={styles.categoryTop}>
                  <strong>{row.meta.name}</strong>
                  <span>{row.done}/{row.total}</span>
                </div>
                <div style={styles.progressShell}>
                  <div style={{ ...styles.progressFill, width: `${Math.round(row.ratio * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Next action</h2>
            <span style={styles.panelMeta}>{unlockAll ? 'override enabled' : 'normal progress'}</span>
          </div>
          <div style={styles.nextBox}>
            <p style={styles.nextTitle}>
              {nextModule ? nextModule.title : 'Path complete'}
            </p>
            <p style={styles.nextCopy}>
              {nextModule
                ? `Continue with ${nextModule.eyebrow}.`
                : 'All modules are complete. You can return to the learning flow or keep the override on for review.'}
            </p>
            {lastUnlocked ? <p style={styles.nextMeta}>Last unlocked: {lastUnlocked.title}</p> : null}
            {weakest ? <p style={styles.nextMeta}>Most work left: {weakest.meta.name}</p> : null}
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Recent modules</h2>
            <span style={styles.panelMeta}>Latest part of the path</span>
          </div>
          <div style={styles.moduleList}>
            {recentModules.map((module) => {
              const done = completedSet.has(module.id);
              const passed = theoryPassedSet.has(module.id);
              return (
                <div key={module.id} style={styles.moduleRow}>
                  <div>
                    <p style={styles.moduleEyebrow}>{module.eyebrow}</p>
                    <p style={styles.moduleTitle}>{module.title}</p>
                  </div>
                  <div style={styles.moduleFlags}>
                    <span style={done ? styles.flagDone : styles.flagPending}>{done ? 'complete' : 'locked'}</span>
                    <span style={passed ? styles.flagDone : styles.flagPending}>{passed ? 'theory passed' : 'theory pending'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}

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
    margin: '8px 0 0',
    fontSize: 'clamp(2rem, 4vw, 3.2rem)',
    lineHeight: 1.02,
  },
  copy: {
    margin: '14px 0 0',
    maxWidth: 760,
    color: 'rgba(244,247,251,0.84)',
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
    marginTop: 10,
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1,
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
