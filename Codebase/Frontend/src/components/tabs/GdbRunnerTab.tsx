import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { runPatternTestsStreaming, fetchMyTestRunStats, GdbTestResult, AdminTestRunStats } from '../../api/client';
import { logFrontendEvent } from '../../logic/frontendLog';

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

// Phase order on the studio Tests tab. Three live phases, applied to the
// user's submitted C++ source. Integration and E2E are NOT phases here —
// see the trophy explainer banner for why a class declaration does not
// have those layers to exercise.
const PHASE_LABEL: Record<string, string> = {
  static_analysis: '1. Static analysis (cppcheck)',
  compile_run:     '2. Code compiles & runs',
  unit_test:       '3. Unit-test verdict',
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
  staticAnalysis?: GdbTestResult;
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
    if (r.phase === 'static_analysis') g.staticAnalysis = r;
    else if (r.phase === 'compile_run') g.compileRun = r;
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
  phase: 'static_analysis' | 'compile_run' | 'unit_test';
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
    <div
      className={`gdb-phase-row gdb-phase-${status}`}
      data-testid="gdb-phase-row"
      data-phase={phase}
      data-status={status}
      data-verdict={result?.verdict ?? ''}
    >
      <header className="gdb-phase-head">
        <span className="gdb-phase-label">{label}</span>
        {loading
          ? <span className="gdb-phase-spinner" aria-hidden="true" />
          : <span className="gdb-phase-pill">{verdictText}</span>}
        {result && <span className="gdb-phase-duration">{result.durationMs} ms</span>}
      </header>
      {result?.message && <p className="gdb-phase-message">{result.message}</p>}
      <CriteriaList result={result} />
      {result?.actual && (() => {
        // Split combined stdout+stderr stream into two panes so the user
        // can see what their program PRINTED (stdout) separately from any
        // compiler/runtime ERRORS (stderr). The runner concatenates them
        // with a `--- stderr ---` divider; we split on it here.
        const raw = result.actual;
        const idx = raw.indexOf('\n--- stderr ---\n');
        const stdout = idx >= 0 ? raw.slice(0, idx) : raw;
        const stderr = idx >= 0 ? raw.slice(idx + '\n--- stderr ---\n'.length) : '';
        const failedOrCompileError = result && !result.passed && result.verdict !== 'skipped';
        return (
          <>
            {stdout.trim().length > 0 && (
              <details className="gdb-result-pane" open={result?.passed === true || failedOrCompileError}>
                <summary>Console output (stdout)</summary>
                <pre>{stdout}</pre>
              </details>
            )}
            {stderr.trim().length > 0 && (
              <details className="gdb-result-pane gdb-result-pane--err" open={failedOrCompileError}>
                <summary>{failedOrCompileError ? 'Error output (auto-expanded)' : 'stderr'}</summary>
                <pre>{stderr}</pre>
              </details>
            )}
            {stdout.trim().length === 0 && stderr.trim().length === 0 && (
              <details className="gdb-result-pane">
                <summary>Console output — no I/O terminal</summary>
                <pre>
(Your program ran but didn&apos;t print anything and didn&apos;t read from
stdin — there&apos;s no terminal session to display.)
                </pre>
              </details>
            )}
          </>
        );
      })()}
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
  const {
    currentRun, setActiveTab, setGdbAllPassedForRun,
    lastGdbResults, lastGdbRunKey, setLastGdbResults,
    pendingGdbAutoRun, setPendingGdbAutoRun,
    programStdin,
    gdbBusy: busy, gdbBusyForKey, gdbInflightSkeleton,
    gdbError: error, gdbUnavailable: unavailable,
    gdbCooldownUntil: cooldownUntil, gdbBudgetRemaining: budgetRemaining,
    gdbAmbiguousBlock: ambiguousBlock,
    setGdbBusy, setGdbInflightSkeleton, setGdbError, setGdbUnavailable,
    setGdbCooldownUntil, setGdbBudgetRemaining, setGdbAmbiguousBlock
  } = useAppStore();
  // Session key for the current run — id-based when saved, pendingId-based
  // when unsaved. The cached GDB results in the store are only valid when
  // this matches `lastGdbRunKey`; mismatch means the user has submitted
  // new code and must re-run.
  const sessionKey = currentRun
    ? (currentRun.runId != null ? `run:${currentRun.runId}` : `pending:${currentRun.pendingId || ''}`)
    : '';
  const cachedValid = !!lastGdbResults && lastGdbRunKey === sessionKey && lastGdbResults.length > 0;
  // Groups are now derived from store state on every render — while a run is
  // in flight we render the skeleton from the store; otherwise we render the
  // cached final results. This is what makes the runner survive a tab switch:
  // the busy spinner / skeleton lives in the global store, not in local
  // useState that gets blown away on unmount.
  const groups: PatternGroup[] = useMemo(() => {
    // While busy, prefer live partial results (compile_run rows that have
    // already streamed in via SSE) over the skeleton — that way the user
    // sees the compile verdict the moment it lands instead of staring at
    // an empty placeholder until unit_test also finishes.
    if (busy && gdbBusyForKey === sessionKey) {
      if (cachedValid && lastGdbResults && lastGdbResults.length > 0) {
        return groupResults(lastGdbResults);
      }
      if (gdbInflightSkeleton.length > 0) {
        return gdbInflightSkeleton.map(s => ({ ...s }));
      }
    }
    return cachedValid ? groupResults(lastGdbResults!) : [];
  }, [busy, gdbBusyForKey, gdbInflightSkeleton, cachedValid, lastGdbResults, sessionKey]);
  const [activeKey, setActiveKey] = useState<string>(
    cachedValid && lastGdbResults && lastGdbResults.length > 0
      ? `${lastGdbResults[0].patternId}__${lastGdbResults[0].className}`
      : ''
  );
  const [now, setNow] = useState(Date.now());
  const [accuracy, setAccuracy] = useState<AdminTestRunStats | null>(null);

  // Pull the user's lifetime test-pass-rate so the studio sidebar can show
  // an accuracy chip. Refetched after every successful run via the same
  // groups dependency below.
  useEffect(() => {
    fetchMyTestRunStats().then(setAccuracy).catch(() => setAccuracy(null));
  }, [groups]);

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
  // The runner is stateless per click: pressing "Run all tests" always
  // clears the cached results for this session and dispatches a fresh run.
  // This protects against stale state across refreshes / tab switches and
  // matches the user's mental model — if they're on the submit button,
  // they intend to run, not be told they already did.
  const canRun = (runId !== null || !!pendingId)
              && localAmbiguous.length === 0;

  const cooldownLeftMs = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const onCooldown = cooldownLeftMs > 0;

  // Auto-run hook for the Annotated tab CTA. When the flag is set we
  // dispatch runAll once and reset it so a later visit to this tab
  // doesn't accidentally fire again. Gated on canRun + !busy + !onCooldown
  // so partial / interrupted state never auto-retriggers.
  useEffect(() => {
    if (!pendingGdbAutoRun) return;
    setPendingGdbAutoRun(false);
    if (canRun && !busy && !onCooldown) {
      void runAll();
    }
    // runAll is stable enough for this effect's intent — it reads from
    // refs/state internally and we only ever invoke it once per flag flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGdbAutoRun]);

  async function runAll(): Promise<void> {
    if (!canRun || busy || onCooldown) return;
    if (!currentRun) return;
    if (localAmbiguous.length > 0) {
      setGdbAmbiguousBlock(localAmbiguous);
      return;
    }
    const resolvedMap = currentRun.classResolvedPatterns || {};
    setGdbError(null);
    setGdbUnavailable(null);
    setGdbAmbiguousBlock(null);
    // Stateless re-run: drop any cached results for this session before
    // dispatching, so the UI shows the fresh skeleton instead of stale rows.
    setLastGdbResults(null, null);
    setActiveKey('');

    const skeleton = (currentRun?.detectedPatterns || [])
      .filter(p => !!p.className)
      .map(p => ({
        patternId: p.patternId,
        patternName: p.patternName || p.patternId,
        className: p.className!
      }));
    // Push busy + skeleton into the GLOBAL store so a tab switch doesn't
    // unmount this state. The component-local useState that used to live
    // here got blown away on every navigation, making the in-flight run
    // look like it was interrupted.
    setGdbInflightSkeleton(skeleton);
    setGdbBusy(true, sessionKey);
    logFrontendEvent('frontend.gdb_test', `dispatch patterns=${skeleton.length}`);
    try {
      // Streaming variant: each phase result lands as a discrete SSE
      // event, and we accumulate them into a single partial array that
      // gets pushed to the store after every event. The store-driven
      // re-render is what gives the user "compile pass" feedback the
      // moment compile_run finishes, before unit_test runs.
      const accumulated: GdbTestResult[] = [];
      let firstActiveKeySet = false;
      const handle = await runPatternTestsStreaming(
        runId !== null
          ? {
              runId, classResolvedPatterns: resolvedMap, stdin: programStdin,
              onEvent: (ev) => {
                if (ev.type !== 'phase') return;
                accumulated.push(ev.result);
                if (!firstActiveKeySet) {
                  setActiveKey(`${ev.result.patternId}__${ev.result.className}`);
                  firstActiveKeySet = true;
                }
                setLastGdbResults([...accumulated], sessionKey);
              }
            }
          : {
              pendingId: pendingId!, classResolvedPatterns: resolvedMap, stdin: programStdin,
              onEvent: (ev) => {
                if (ev.type !== 'phase') return;
                accumulated.push(ev.result);
                if (!firstActiveKeySet) {
                  setActiveKey(`${ev.result.patternId}__${ev.result.className}`);
                  firstActiveKeySet = true;
                }
                setLastGdbResults([...accumulated], sessionKey);
              }
            }
      );
      const final = await handle.finished;
      setGdbBudgetRemaining(final.rateLimit?.remaining ?? null);
      const passed = accumulated.filter(r => r.passed).length;
      setGdbAllPassedForRun(accumulated.length > 0 && passed === accumulated.length);
      logFrontendEvent('frontend.gdb_test', `complete pass=${passed}/${accumulated.length}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 503) {
        setGdbUnavailable(e.detail || e.message || 'Test runner not configured.');
      } else if (e.status === 429) {
        const ms = e.retryAfterMs || 60_000;
        setGdbCooldownUntil(Date.now() + ms);
        setGdbError(e.detail || `Rate limited. Try again in ${Math.ceil(ms / 1000)}s.`);
      } else if (e.status === 409 && Array.isArray(e.ambiguousClasses)) {
        setGdbAmbiguousBlock(e.ambiguousClasses);
      } else {
        setGdbError(e.message || 'Failed to run tests.');
        logFrontendEvent('frontend.gdb_test', `error ${(e.message || '').slice(0, 100)}`);
      }
    } finally {
      setGdbBusy(false);
    }
  }

  const active = groups.find(g => `${g.patternId}__${g.className}` === activeKey)
              || groups[0]
              || null;

  return (
    <section className="tab-panel tab-gdb">
      {/* Per D67: Testing Trophy banner. Documents the testing strategy
          in-line so the studio surface matches what /research describes.
          Phases the backend already runs are linked-to from the per-pattern
          breakdown below; planned phases are listed here as a roadmap. */}
      <aside className="gdb-trophy-banner" aria-label="Testing Trophy strategy">
        <header>
          <span className="gdb-trophy-eyebrow">Testing Trophy &mdash; applied to your submission</span>
          <h2 className="gdb-trophy-title">How NeoTerritory tests your code</h2>
        </header>
        <ol className="gdb-trophy-phases">
          <li className="gdb-trophy-phase gdb-trophy-phase--live" data-phase="static_analysis">
            <span className="gdb-trophy-num">01</span>
            <div>
              <p className="gdb-trophy-phase-name">Static analysis</p>
              <p className="gdb-trophy-phase-note">
                Live: cppcheck scans your source for likely defects and style issues. Runs first
                because static findings are the cheapest to surface. Findings never block the
                downstream phases.
              </p>
            </div>
          </li>
          <li className="gdb-trophy-phase gdb-trophy-phase--live" data-phase="compile_run">
            <span className="gdb-trophy-num">02</span>
            <div>
              <p className="gdb-trophy-phase-name">Compile &amp; run</p>
              <p className="gdb-trophy-phase-note">
                Live: your class compiles under g++ and exits cleanly on its own.
              </p>
            </div>
          </li>
          <li className="gdb-trophy-phase gdb-trophy-phase--live" data-phase="unit_test">
            <span className="gdb-trophy-num">03</span>
            <div>
              <p className="gdb-trophy-phase-name">Unit / contract test</p>
              <p className="gdb-trophy-phase-note">
                Live: per-pattern scaffolds exercise the contract the pattern implies (Singleton:
                identity stability; Builder: terminal product; etc).
              </p>
            </div>
          </li>
        </ol>
        <p className="gdb-trophy-foot">
          Strategy: <strong>Testing Trophy</strong> (Kent C. Dodds). Read more on{' '}
          <a
            href="/docs"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState(null, '', '/docs');
              window.dispatchEvent(new CustomEvent('nt:navigate'));
            }}
          >
            /docs
          </a>
          .
        </p>
      </aside>
      <header className="results-header">
        <p className="results-summary">
          Pre-templated unit tests · {runId !== null ? `run #${runId}` : 'unsaved run'}
          {budgetRemaining !== null && (
            <span className="gdb-budget"> · {budgetRemaining} run(s) left this minute</span>
          )}
          {accuracy && accuracy.total > 0 && (
            <span className="gdb-accuracy" title={`${accuracy.passed} pass / ${accuracy.failed} fail across all your runs`}>
              {' · '}
              <strong>{(accuracy.passRate * 100).toFixed(0)}%</strong> accuracy
              {' '}({accuracy.passed}✓/{accuracy.failed}✗)
            </span>
          )}
        </p>
        <button
          type="button"
          className="primary-btn"
          data-testid="run-all-tests-btn"
          onClick={runAll}
          disabled={!canRun || busy || onCooldown}
          title={
            localAmbiguous.length > 0
              ? `Resolve ambiguity for: ${localAmbiguous.join(', ')}`
              : cachedValid
                ? 'Re-run clears the previous results for this submission.'
                : undefined
          }
        >
          {busy
            ? 'Running…'
            : onCooldown
              ? `Cooldown ${Math.ceil(cooldownLeftMs / 1000)}s`
              : cachedValid
                ? 'Re-run tests'
                : 'Run all tests'}
        </button>
        {/* Visible disabled-reason chip so the click is never a black hole.
            Shows only when the button is disabled and we are not actively
            running. Matches the disabled-state precedence order from runAll(). */}
        {!busy && (!canRun || onCooldown) && (
          <p className="gdb-disabled-reason" role="status" aria-live="polite">
            {onCooldown
              ? `Cooldown active — retry in ${Math.ceil(cooldownLeftMs / 1000)}s.`
              : runId === null && !pendingId
                ? 'Start an analysis run first — then come back to test it.'
                : localAmbiguous.length > 0
                  ? `Resolve ambiguous class${localAmbiguous.length === 1 ? '' : 'es'} (${localAmbiguous.join(', ')}) on the Annotated source tab before running tests.`
                  : 'Tests are not available for this run.'}
          </p>
        )}
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
              <PhaseRow phase="static_analysis" result={active.staticAnalysis} loading={busy && !active.staticAnalysis} />
              <PhaseRow phase="compile_run"     result={active.compileRun}     loading={busy && !active.compileRun} />
              <PhaseRow phase="unit_test"       result={active.unitTest}       loading={busy && active.compileRun?.passed === true && !active.unitTest} />
            </article>
          )}
        </div>
      )}
    </section>
  );
}
