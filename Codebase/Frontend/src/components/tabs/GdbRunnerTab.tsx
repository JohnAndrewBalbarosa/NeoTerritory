import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { runPatternTests, GdbTestResult } from '../../api/client';
import { logFrontendEvent } from '../../lib/frontendLog';

const VERDICT_LABEL: Record<string, string> = {
  pass:              'pass',
  fail:              'fail',
  timeout:           'timeout',
  segfault:          'segfault',
  leak:              'memory leak',
  compile_error:     'compile error',
  sandbox_disabled:  'runner off',
  no_template:       'no template',
  skipped:           'skipped'
};

const PHASE_LABEL: Record<string, string> = {
  compile_run: '1. Code compiles & runs',
  unit_test:   '2. Unit-test verdict'
};

const FAMILY_LABEL: Record<string, string> = {
  creational:  'Creational',
  structural:  'Structural',
  behavioural: 'Behavioural'
};

interface ApiError extends Error {
  status?: number;
  detail?: string;
  retryAfterMs?: number;
  ambiguousClasses?: string[];
}

interface PatternGroup {
  patternId: string;
  patternName: string;
  className: string;
  compileRun?: GdbTestResult;
  unitTest?: GdbTestResult;
}

function familyOf(patternId: string): string {
  const fam = (patternId.split('.')[0] || 'other').toLowerCase();
  return FAMILY_LABEL[fam] || fam.charAt(0).toUpperCase() + fam.slice(1);
}

function groupResults(results: GdbTestResult[]): PatternGroup[] {
  const map = new Map<string, PatternGroup>();
  for (const r of results) {
    const key = `${r.patternId}__${r.className}`;
    const g = map.get(key) || {
      patternId: r.patternId,
      patternName: r.patternName,
      className: r.className
    };
    if (r.phase === 'compile_run') g.compileRun = r;
    else if (r.phase === 'unit_test') g.unitTest = r;
    map.set(key, g);
  }
  return [...map.values()];
}

// Build a Family -> Pattern -> Class[] tree from the flat group list. We hide
// families and patterns with zero groups so the tree only surfaces what the
// current run actually produced.
interface TreeNode {
  family: string;
  patterns: Array<{
    patternId: string;
    patternName: string;
    classes: PatternGroup[];
  }>;
}
function buildTree(groups: PatternGroup[]): TreeNode[] {
  const byFamily = new Map<string, Map<string, PatternGroup[]>>();
  for (const g of groups) {
    const fam = familyOf(g.patternId);
    if (!byFamily.has(fam)) byFamily.set(fam, new Map());
    const patternMap = byFamily.get(fam)!;
    if (!patternMap.has(g.patternId)) patternMap.set(g.patternId, []);
    patternMap.get(g.patternId)!.push(g);
  }
  const out: TreeNode[] = [];
  for (const [fam, patternMap] of byFamily) {
    const patterns: TreeNode['patterns'] = [];
    for (const [patternId, classes] of patternMap) {
      patterns.push({ patternId, patternName: classes[0]?.patternName || patternId, classes });
    }
    patterns.sort((a, b) => a.patternName.localeCompare(b.patternName));
    out.push({ family: fam, patterns });
  }
  out.sort((a, b) => a.family.localeCompare(b.family));
  return out;
}

function CriteriaList({ result }: { result?: GdbTestResult }) {
  if (!result?.criteria || result.criteria.length === 0) return null;
  return (
    <ul className="gdb-criteria-list">
      {result.criteria.map((c, i) => (
        <li key={i} className={`gdb-criterion gdb-criterion-${c.status}`}>
          <span className="gdb-criterion-status">{c.status}</span>
          <span className="gdb-criterion-desc">{c.description}</span>
        </li>
      ))}
    </ul>
  );
}

function PhaseRow({ phase, result, loading }: {
  phase: 'compile_run' | 'unit_test';
  result?: GdbTestResult;
  loading: boolean;
}) {
  const label = PHASE_LABEL[phase];
  const status = loading
    ? 'loading'
    : !result
      ? 'idle'
      : result.passed ? 'pass' : (result.verdict === 'skipped' ? 'skipped' : 'fail');
  const verdictText = result ? VERDICT_LABEL[result.verdict] || result.verdict : 'idle';
  return (
    <div className={`gdb-phase-row gdb-phase-${status}`} data-status={status}>
      <header className="gdb-phase-head">
        <span className="gdb-phase-label">{label}</span>
        {loading
          ? <span className="gdb-phase-spinner" aria-hidden="true" />
          : <span className="gdb-phase-pill">{verdictText}</span>}
        {result && <span className="gdb-phase-duration">{result.durationMs} ms</span>}
      </header>
      {result?.message && <p className="gdb-phase-message">{result.message}</p>}
      <CriteriaList result={result} />
      {result?.actual && (
        <details className="gdb-result-pane">
          <summary>actual / stderr</summary>
          <pre>{result.actual}</pre>
        </details>
      )}
      {result?.gdb && (
        <details className="gdb-result-pane">
          <summary>gdb output</summary>
          <pre>{result.gdb}</pre>
        </details>
      )}
    </div>
  );
}

export default function GdbRunnerTab() {
  const { currentRun, setActiveTab, setGdbAllPassedForRun } = useAppStore();
  const [groups, setGroups] = useState<PatternGroup[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [ambiguousBlock, setAmbiguousBlock] = useState<string[] | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const tree = useMemo(() => buildTree(groups), [groups]);

  // Local-side ambiguity gate: if the run still has classes with multiple
  // detected patterns and no resolution, block the request and prompt the
  // user to fix it on the Annotated tab. The backend re-checks defensively.
  const localAmbiguous = useMemo(() => {
    const run = currentRun;
    if (!run) return [] as string[];
    const counts = new Map<string, number>();
    for (const p of run.detectedPatterns || []) {
      if (!p.className) continue;
      counts.set(p.className, (counts.get(p.className) || 0) + 1);
    }
    const resolved = run.classResolvedPatterns || {};
    const out: string[] = [];
    for (const [name, c] of counts) {
      if (c > 1 && !resolved[name]) out.push(name);
    }
    return out.sort();
  }, [currentRun]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-gdb tab-empty">
        <p>Run an analysis first to enable the test runner.</p>
      </section>
    );
  }

  const runId = currentRun.runId ?? null;
  const pendingId = currentRun.pendingId ?? null;
  const canRun = (runId !== null || !!pendingId) && localAmbiguous.length === 0;

  const cooldownLeftMs = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const onCooldown = cooldownLeftMs > 0;

  async function runAll(): Promise<void> {
    if (!canRun || busy || onCooldown) return;
    if (!currentRun) return;
    if (localAmbiguous.length > 0) {
      setAmbiguousBlock(localAmbiguous);
      return;
    }
    const resolvedMap = currentRun.classResolvedPatterns || {};
    setBusy(true);
    setError(null);
    setUnavailable(null);
    setAmbiguousBlock(null);

    const skeleton: PatternGroup[] = (currentRun?.detectedPatterns || [])
      .filter(p => !!p.className)
      .map(p => ({
        patternId: p.patternId,
        patternName: p.patternName || p.patternId,
        className: p.className!
      }));
    setGroups(skeleton);
    logFrontendEvent('frontend.gdb_test', `dispatch patterns=${skeleton.length}`);
    try {
      const data = await runPatternTests(
        runId !== null
          ? { runId, classResolvedPatterns: resolvedMap }
          : { pendingId: pendingId!, classResolvedPatterns: resolvedMap }
      );
      const grouped = groupResults(data.results);
      setGroups(grouped);
      if (grouped.length > 0) {
        setActiveKey(`${grouped[0].patternId}__${grouped[0].className}`);
      }
      setBudgetRemaining(data.rateLimit?.remaining ?? null);
      const passed = data.results.filter(r => r.passed).length;
      // The Annotated tab's CTA gate: only allow advancing to Review once
      // every emitted test result passed for the current run.
      setGdbAllPassedForRun(data.results.length > 0 && passed === data.results.length);
      logFrontendEvent('frontend.gdb_test', `complete pass=${passed}/${data.results.length}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 503) {
        setUnavailable(e.detail || e.message || 'Test runner not configured.');
      } else if (e.status === 429) {
        const ms = e.retryAfterMs || 60_000;
        setCooldownUntil(Date.now() + ms);
        setError(e.detail || `Rate limited. Try again in ${Math.ceil(ms / 1000)}s.`);
      } else if (e.status === 409 && Array.isArray(e.ambiguousClasses)) {
        setAmbiguousBlock(e.ambiguousClasses);
      } else {
        setError(e.message || 'Failed to run tests.');
        logFrontendEvent('frontend.gdb_test', `error ${(e.message || '').slice(0, 100)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const active = groups.find(g => `${g.patternId}__${g.className}` === activeKey)
              || groups[0]
              || null;

  return (
    <section className="tab-panel tab-gdb">
      <header className="results-header">
        <p className="results-summary">
          Pre-templated unit tests · {runId !== null ? `run #${runId}` : 'unsaved run'}
          {budgetRemaining !== null && (
            <span className="gdb-budget"> · {budgetRemaining} run(s) left this minute</span>
          )}
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={runAll}
          disabled={!canRun || busy || onCooldown}
          title={localAmbiguous.length > 0
            ? `Resolve ambiguity for: ${localAmbiguous.join(', ')}`
            : undefined}
        >
          {busy
            ? 'Running…'
            : onCooldown
              ? `Cooldown ${Math.ceil(cooldownLeftMs / 1000)}s`
              : groups.length > 0 ? 'Re-run all' : 'Run all tests'}
        </button>
      </header>

      {(localAmbiguous.length > 0 || ambiguousBlock) && (
        <div className="error-banner gdb-ambiguous-banner" role="alert">
          <strong>Ambiguous classes need a tag.</strong>
          <p>
            These classes still have competing pattern guesses:{' '}
            <code>{(ambiguousBlock || localAmbiguous).join(', ')}</code>.
            Tests can't run until you pick a pattern for each one on the
            Annotated source tab.
          </p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setActiveTab('annotated')}
          >
            Go to Annotated source →
          </button>
        </div>
      )}

      {unavailable && (
        <div className="gdb-unavailable">
          <strong>Test runner not configured.</strong>
          <p>{unavailable}</p>
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {groups.length === 0 && !busy && (
        <p className="tab-empty">Run the tests to see per-pattern verdicts here.</p>
      )}

      {tree.length > 0 && (
        <div className="gdb-tree-layout">
          <nav className="gdb-tree" aria-label="Test results tree">
            {tree.map(node => (
              <details key={node.family} open className="gdb-tree-family">
                <summary className="gdb-tree-family-head">
                  {node.family}
                  <span className="gdb-tree-count">{node.patterns.length}</span>
                </summary>
                {node.patterns.map(p => (
                  <details key={p.patternId} open className="gdb-tree-pattern">
                    <summary className="gdb-tree-pattern-head">
                      {p.patternName}
                      <span className="gdb-tree-count">{p.classes.length}</span>
                    </summary>
                    <ul className="gdb-tree-classes">
                      {p.classes.map(g => {
                        const k = `${g.patternId}__${g.className}`;
                        const overall =
                          !g.compileRun && !g.unitTest ? 'idle' :
                          g.compileRun && !g.compileRun.passed ? 'fail' :
                          g.unitTest?.passed ? 'pass' :
                          g.unitTest && !g.unitTest.passed ? 'fail' :
                          'loading';
                        return (
                          <li key={k}>
                            <button
                              type="button"
                              className={`gdb-tree-class${activeKey === k ? ' is-active' : ''}`}
                              data-overall={overall}
                              onClick={() => setActiveKey(k)}
                              title={`${g.patternName} · ${g.className}`}
                            >
                              <span className="gdb-tab-dot" aria-hidden="true" />
                              {g.className}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ))}
              </details>
            ))}
          </nav>

          {active && (
            <article className="gdb-tab-pane gdb-pattern-pane">
              <header className="gdb-result-head">
                <span className="gdb-result-class">{active.className}</span>
                <span className="gdb-result-pattern">{active.patternName}</span>
              </header>
              <PhaseRow phase="compile_run" result={active.compileRun} loading={busy && !active.compileRun} />
              <PhaseRow phase="unit_test"   result={active.unitTest}   loading={busy && active.compileRun?.passed === true && !active.unitTest} />
            </article>
          )}
        </div>
      )}
    </section>
  );
}
