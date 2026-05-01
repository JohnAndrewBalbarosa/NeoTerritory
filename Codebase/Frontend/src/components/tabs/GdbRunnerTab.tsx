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
  no_template:       'no template'
};

interface ApiError extends Error {
  status?: number;
  detail?: string;
  retryAfterMs?: number;
}

export default function GdbRunnerTab() {
  const { currentRun } = useAppStore();
  const [results, setResults] = useState<GdbTestResult[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);

  // Tick the cooldown countdown so the disabled button label refreshes.
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

  // GDB runner does NOT require a saved run; pendingId works too.
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
    try {
      const data = await runPatternTests(
        runId !== null ? { runId } : { pendingId: pendingId! }
      );
      setResults(data.results);
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

  const active = results && results.length > 0 ? results[activeIdx] : null;

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
          <p>
            See <code>docs/TODO/test-runner-gdb.md</code>. Set
            {' '}<code>ENABLE_TEST_RUNNER=1</code> and <code>TEST_RUNNER_SANDBOX</code>
            {' '}in the backend <code>.env</code> to enable.
          </p>
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {results && results.length === 0 && (
        <p className="tab-empty">No detected patterns to test.</p>
      )}

      {results && results.length > 0 && (
        <>
          <nav className="gdb-tab-bar" role="tablist" aria-label="Test results">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                className={`gdb-tab ${i === activeIdx ? 'is-active' : ''}`}
                data-passed={r.passed ? 'true' : 'false'}
                onClick={() => setActiveIdx(i)}
                title={`${r.patternName} · ${r.className} · ${VERDICT_LABEL[r.verdict] || r.verdict}`}
              >
                <span className="gdb-tab-dot" aria-hidden="true" />
                <span className="gdb-tab-label">{r.className}</span>
                <span className="gdb-tab-verdict">{VERDICT_LABEL[r.verdict] || r.verdict}</span>
              </button>
            ))}
          </nav>

          {active && (
            <article
              className="gdb-tab-pane"
              data-verdict={active.verdict}
              data-passed={active.passed ? 'true' : 'false'}
            >
              <header className="gdb-result-head">
                <span className="gdb-result-class">{active.className}</span>
                <span className="gdb-result-pattern">{active.patternName}</span>
                <span className="gdb-result-pill">{VERDICT_LABEL[active.verdict] || active.verdict}</span>
                <span className="gdb-result-duration">{active.durationMs} ms</span>
              </header>
              {active.message && <p className="gdb-result-message">{active.message}</p>}
              {active.actual && (
                <details className="gdb-result-pane" open>
                  <summary>actual / stderr</summary>
                  <pre>{active.actual}</pre>
                </details>
              )}
              {active.gdb && (
                <details className="gdb-result-pane">
                  <summary>gdb output</summary>
                  <pre>{active.gdb}</pre>
                </details>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}
