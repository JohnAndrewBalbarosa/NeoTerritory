import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { runPatternTests, GdbTestResult } from '../../api/client';

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

interface ApiError extends Error {
  status?: number;
  detail?: string;
  retryAfterMs?: number;
}

interface PatternGroup {
  patternId: string;
  patternName: string;
  className: string;
  compileRun?: GdbTestResult;
  unitTest?: GdbTestResult;
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
  const { currentRun } = useAppStore();
  const [results, setResults] = useState<GdbTestResult[] | null>(null);
  const [groups, setGroups] = useState<PatternGroup[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-gdb tab-empty">
        <p>Run an analysis first to enable the test runner.</p>
      </section>
    );
  }

  const runId = currentRun.runId ?? null;
  const pendingId = currentRun.pendingId ?? null;
  const canRun = runId !== null || !!pendingId;

  const cooldownLeftMs = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const onCooldown = cooldownLeftMs > 0;

  async function runAll(): Promise<void> {
    if (!canRun || busy || onCooldown) return;
    setBusy(true);
    setError(null);
    setUnavailable(null);
    // Pre-populate group skeletons so the UI shows loading rows for every
    // detected pattern before the first result lands.
    const skeleton: PatternGroup[] = (currentRun?.detectedPatterns || [])
      .filter(p => !!p.className)
      .map(p => ({
        patternId: p.patternId,
        patternName: p.patternName || p.patternId,
        className: p.className!
      }));
    setGroups(skeleton);
    setResults(null);
    try {
      const data = await runPatternTests(
        runId !== null ? { runId } : { pendingId: pendingId! }
      );
      setResults(data.results);
      setGroups(groupResults(data.results));
      setActiveIdx(0);
      setBudgetRemaining(data.rateLimit?.remaining ?? null);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 503) {
        setUnavailable(e.detail || e.message || 'Test runner not configured.');
      } else if (e.status === 429) {
        const ms = e.retryAfterMs || 60_000;
        setCooldownUntil(Date.now() + ms);
        setError(e.detail || `Rate limited. Try again in ${Math.ceil(ms / 1000)}s.`);
      } else {
        setError(e.message || 'Failed to run tests.');
      }
    } finally {
      setBusy(false);
    }
  }

  const active = groups.length > 0 ? groups[activeIdx] : null;

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
        >
          {busy
            ? 'Running…'
            : onCooldown
              ? `Cooldown ${Math.ceil(cooldownLeftMs / 1000)}s`
              : results ? 'Re-run all' : 'Run all tests'}
        </button>
      </header>

      {unavailable && (
        <div className="gdb-unavailable">
          <strong>Test runner not configured.</strong>
          <p>{unavailable}</p>
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {groups.length === 0 && !busy && results && (
        <p className="tab-empty">No detected patterns to test.</p>
      )}

      {groups.length > 0 && (
        <>
          <nav className="gdb-tab-bar" role="tablist" aria-label="Test results">
            {groups.map((g, i) => {
              const overall =
                !g.compileRun && !g.unitTest ? 'idle' :
                g.compileRun && !g.compileRun.passed ? 'fail' :
                g.unitTest?.passed ? 'pass' :
                g.unitTest && !g.unitTest.passed ? 'fail' :
                'loading';
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIdx}
                  className={`gdb-tab ${i === activeIdx ? 'is-active' : ''}`}
                  data-overall={overall}
                  onClick={() => setActiveIdx(i)}
                  title={`${g.patternName} · ${g.className}`}
                >
                  <span className="gdb-tab-dot" aria-hidden="true" />
                  <span className="gdb-tab-label">{g.className}</span>
                </button>
              );
            })}
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
        </>
      )}
    </section>
  );
}
