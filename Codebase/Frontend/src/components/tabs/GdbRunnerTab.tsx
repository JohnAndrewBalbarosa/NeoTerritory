import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { runPatternTests } from '../../api/client';

interface TestResult {
  patternId: string;
  patternName: string;
  className: string;
  passed: boolean;
  expected: string;
  actual: string;
  gdb?: string;
  exitCode: number;
  durationMs: number;
  verdict: string;
  failingLine?: number;
  message?: string;
}

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

export default function GdbRunnerTab() {
  const { currentRun } = useAppStore();
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-gdb tab-empty">
        <p>Run an analysis first to enable the test runner.</p>
      </section>
    );
  }
  if (!currentRun.runId) {
    return (
      <section className="tab-panel tab-gdb tab-empty">
        <p>Save the run before running tests. The runner persists results against the saved <code>runId</code>.</p>
      </section>
    );
  }

  async function runAll() {
    if (!currentRun?.runId) return;
    setBusy(true);
    setError(null);
    setUnavailable(null);
    try {
      const data = await runPatternTests(currentRun.runId);
      setResults(data.results);
    } catch (err) {
      const e = err as Error & { status?: number; detail?: string };
      if (e.status === 503) {
        setUnavailable(e.detail || e.message || 'Test runner not configured.');
      } else {
        setError(e.message || 'Failed to run tests.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tab-panel tab-gdb">
      <header className="results-header">
        <p className="results-summary">
          Pre-templated unit tests · run #{currentRun.runId}
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={runAll}
          disabled={busy}
        >
          {busy ? 'Running…' : results ? 'Re-run all' : 'Run all tests'}
        </button>
      </header>

      {unavailable && (
        <div className="gdb-unavailable">
          <strong>Test runner not configured.</strong>
          <p>{unavailable}</p>
          <p>
            See <code>docs/TODO/test-runner-gdb.md</code> for the sandbox
            options. Once <code>ENABLE_TEST_RUNNER=1</code> and{' '}
            <code>TEST_RUNNER_SANDBOX</code> are set in the backend
            <code>.env</code>, this tab compiles each detected pattern&apos;s
            class against an authored template and runs it under a sandboxed
            compiler.
          </p>
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {results && results.length === 0 && (
        <p className="tab-empty">No detected patterns to test.</p>
      )}

      {results && results.length > 0 && (
        <ul className="gdb-result-list">
          {results.map((r, i) => (
            <li
              key={i}
              className="gdb-result"
              data-verdict={r.verdict}
              data-passed={r.passed ? 'true' : 'false'}
            >
              <header className="gdb-result-head">
                <span className="gdb-result-class">{r.className}</span>
                <span className="gdb-result-pattern">{r.patternName}</span>
                <span className="gdb-result-pill">{VERDICT_LABEL[r.verdict] || r.verdict}</span>
                <span className="gdb-result-duration">{r.durationMs} ms</span>
              </header>
              {r.message && <p className="gdb-result-message">{r.message}</p>}
              {r.actual && (
                <details className="gdb-result-pane">
                  <summary>actual / stderr</summary>
                  <pre>{r.actual}</pre>
                </details>
              )}
              {r.gdb && (
                <details className="gdb-result-pane">
                  <summary>gdb output</summary>
                  <pre>{r.gdb}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
