// Algorithm-only time complexity test.
//
// Validates the thesis claim that NeoTerritory's structural analyzer is
// O(n) where n = input token count, by sweeping increasing input sizes
// through the C++ microservice binary and fitting a linear regression
// on `items_processed` — the count of structural items the analyzer's
// per-class loop actually iterates over.
//
// Why this is immune to "job scheduling / job switching" interference:
//
//   1. We spawn the C++ binary DIRECTLY as a child process. There is
//      no Node.js HTTP layer, no /api/analyze queue, no AI documentation
//      pipeline, no Docker pod warm-up — none of the production-time
//      sources of co-tenant contention can leak into this test.
//
//   2. We measure `items_processed`, which is a COUNT of operations,
//      not a duration. The number of items the analyzer iterates over
//      is determined ENTIRELY by the input. Whether the OS scheduler
//      pauses the process mid-loop or runs it on a single uninterrupted
//      core, the final count is identical. Wall-clock noise simply
//      cannot reach this metric.
//
//   3. The fit threshold (R² >= 0.95) is high because a true O(n)
//      algorithm against an op-count metric should produce a near-
//      perfect line. Anything less means either the algorithm is not
//      linear in this input dimension OR the input synthesis is not
//      keeping the structural shape consistent.
//
// CI integration: this test lives next to the existing vitest files
// and runs in the `backend-microservice-build-and-test` workflow job,
// which already builds the binary before invoking `npm test`. If the
// binary cannot be located (e.g. local dev without a build), the test
// gracefully skips so unrelated work is not blocked.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { countCppTokens } from '../utils/tokenCounter';

interface StageMetric {
  stage_name?: string;
  milliseconds?: number;
  items_processed?: number;
}

interface BinaryReport {
  stage_metrics?: StageMetric[];
}

interface RegressionFit {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

interface SweepPoint {
  inputTokens: number;
  totalItems: number;
}

// Resolve the binary path. Prefer NEOTERRITORY_BIN (set in CI), then
// fall back to the common dev build outputs. Skip the entire test if
// none exist so the suite does not red-light a fresh checkout.
//
// Anchoring: vitest's cwd is whatever `npm test` was invoked from
// (typically Codebase/Backend/ for the existing config). We try the
// raw cwd, then walk up to find a directory containing a `Codebase/`
// sibling so the test works whether you run it from the repo root,
// from Codebase/Backend/, or from anywhere via NEOTERRITORY_BIN.
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'Codebase')) && fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// Resolve the pattern-catalog path. The microservice REQUIRES `--catalog`
// otherwise it processes 0 items and detects 0 patterns (no rules to
// match against). NEOTERRITORY_CATALOG overrides; default is the
// in-repo catalog under Codebase/Microservice/pattern_catalog.
function resolveCatalogPath(): string | null {
  const root = findRepoRoot();
  const candidates = [
    process.env.NEOTERRITORY_CATALOG,
    path.join(root, 'Codebase/Microservice/pattern_catalog'),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const resolved = path.isAbsolute(c) ? c : path.resolve(root, c);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function resolveBinaryPath(): string | null {
  const root = findRepoRoot();
  // Platform-aware ordering: on Windows we MUST pick a .exe (the
  // build-wsl ELF binary exists on disk via the cross-mount but
  // Windows cannot execute it — spawnSync ENOENTs at runtime). On
  // Linux / macOS we prefer the native build and skip the .exe paths.
  const isWindows = process.platform === 'win32';
  const winFirst = [
    path.join(root, 'Codebase/Microservice/build-msys/Release/NeoTerritory.exe'),
    path.join(root, 'Codebase/Microservice/build-msys/Debug/NeoTerritory.exe'),
  ];
  const nixFirst = [
    path.join(root, 'Codebase/Microservice/build/NeoTerritory'),
    path.join(root, 'Codebase/Microservice/build-wsl/NeoTerritory'),
  ];
  const candidates: Array<string | undefined> = [
    process.env.NEOTERRITORY_BIN,
    ...(isWindows ? winFirst : nixFirst),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const resolved = path.isAbsolute(c) ? c : path.resolve(root, c);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

// Synthesize a C++ input by repeating a small canonical pattern N
// times with rename-per-copy so the analyzer does not deduplicate
// structural identicals. This keeps the structural SHAPE constant
// across N (one Singleton + one Builder per copy) while varying the
// COUNT of items the analyzer must process. The op count should track
// the number of copies linearly.
function synthesizeInput(copies: number): string {
  const base = `class Singleton_{i} {
public:
  static Singleton_{i}& getInstance() {
    static Singleton_{i} instance;
    return instance;
  }
  Singleton_{i}(const Singleton_{i}&) = delete;
  Singleton_{i}& operator=(const Singleton_{i}&) = delete;
private:
  Singleton_{i}() = default;
};

class Product_{i} {};
class Builder_{i} {
public:
  Builder_{i}& withName(const std::string& n) { name_ = n; return *this; }
  Builder_{i}& withCount(int c) { count_ = c; return *this; }
  Product_{i} build() { return Product_{i}(); }
private:
  std::string name_;
  int count_ = 0;
};
`;
  const parts: string[] = ['#include <string>'];
  for (let i = 0; i < copies; i++) {
    parts.push(base.replace(/\{i\}/g, String(i)));
  }
  return parts.join('\n');
}

function runBinaryOnce(binaryPath: string, catalogPath: string, sourceCode: string): BinaryReport {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-complexity-'));
  try {
    const inputPath = path.join(tmpDir, 'input.cpp');
    const outputDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outputDir);
    fs.writeFileSync(inputPath, sourceCode, 'utf8');
    const result = spawnSync(
      binaryPath,
      ['--catalog', catalogPath, '--output', outputDir, inputPath],
      { encoding: 'utf8', timeout: 60_000 },
    );
    if (result.error) {
      throw new Error(
        `binary spawn failed: ${result.error.message} (path=${binaryPath})`,
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `binary exited ${result.status} (signal=${result.signal ?? 'none'}); stderr: ${result.stderr?.slice(0, 400) ?? ''}; stdout: ${result.stdout?.slice(0, 200) ?? ''}`,
      );
    }
    const reportPath = path.join(outputDir, 'report.json');
    if (!fs.existsSync(reportPath)) {
      throw new Error(`binary did not produce report.json at ${reportPath}`);
    }
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as BinaryReport;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function fitOls(points: SweepPoint[]): RegressionFit {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.inputTokens, 0) / n;
  const meanY = points.reduce((s, p) => s + p.totalItems, 0) / n;
  let num = 0;
  let denX = 0;
  for (const p of points) {
    num += (p.inputTokens - meanX) * (p.totalItems - meanY);
    denX += (p.inputTokens - meanX) ** 2;
  }
  const slope = denX === 0 ? 0 : num / denX;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const yHat = slope * p.inputTokens + intercept;
    ssRes += (p.totalItems - yHat) ** 2;
    ssTot += (p.totalItems - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2, n };
}

const binaryPath = resolveBinaryPath();
const catalogPath = resolveCatalogPath();
const canRun = !!(binaryPath && catalogPath);
const describeIfRuntime = canRun ? describe : describe.skip;

describeIfRuntime('algorithm time complexity (O(n) on items_processed)', () => {
  // Sweep five input sizes spanning ~10x. Synthesized inputs use
  // copy-counts that produce roughly linearly-varying token counts so
  // the regression has clear leverage at both ends. Five points is
  // enough for OLS to be meaningful; more would inflate test runtime
  // without strengthening the assertion.
  const COPY_COUNTS = [2, 5, 10, 20, 40] as const;

  it('items_processed scales linearly with input token count', () => {
    expect(binaryPath, 'binary path resolved').toBeTruthy();
    const sweep: SweepPoint[] = [];
    for (const copies of COPY_COUNTS) {
      const source = synthesizeInput(copies);
      const inputTokens = countCppTokens(source);
      const report = runBinaryOnce(binaryPath!, catalogPath!, source);
      const totalItems = (report.stage_metrics ?? []).reduce(
        (sum, m) => sum + (typeof m.items_processed === 'number' ? m.items_processed : 0),
        0,
      );
      sweep.push({ inputTokens, totalItems });
    }

    // Every point should record SOME work — if the binary reports 0
    // items across the board, the regression below is meaningless.
    for (const p of sweep) {
      expect(p.inputTokens, `tokens > 0 for ${JSON.stringify(p)}`).toBeGreaterThan(0);
      expect(p.totalItems, `items > 0 for ${JSON.stringify(p)}`).toBeGreaterThan(0);
    }

    const fit = fitOls(sweep);

    // Diagnostic dump — failures will print this so the operator can
    // see the raw sweep without re-running locally.
    const summary = sweep
      .map((p) => `  tokens=${p.inputTokens} items=${p.totalItems}`)
      .join('\n');
    const fitMsg = `R²=${fit.r2.toFixed(4)} slope=${fit.slope.toFixed(4)} intercept=${fit.intercept.toFixed(2)} n=${fit.n}\n${summary}`;

    // O(n) claim: linear fit explains ≥ 95% of variance. A true linear
    // operation count should produce R² > 0.99 in practice; 0.95 leaves
    // headroom for the small structural-shape jitter that synthesizing
    // copies introduces at the smallest input size.
    expect(fit.r2, `R² >= 0.95 for op-count linearity\n${fitMsg}`).toBeGreaterThanOrEqual(0.95);

    // Positive slope — the algorithm DOES process more items as input
    // grows. A flat or negative slope would mean either the binary is
    // ignoring our synthesized copies or items_processed is broken.
    expect(fit.slope, `slope > 0\n${fitMsg}`).toBeGreaterThan(0);

    // Fixed-overhead bound: at the largest input size, the constant
    // (intercept) should be a minority of the total predicted work.
    // Concretely: |intercept| < 50% × slope × max_tokens. If the
    // intercept dominates, the algorithm has a heavy non-input cost
    // that breaks the O(n) framing.
    const maxTokens = Math.max(...sweep.map((p) => p.inputTokens));
    const dominanceLimit = 0.5 * fit.slope * maxTokens;
    expect(
      Math.abs(fit.intercept),
      `|intercept| < 50% of slope*max_tokens (${dominanceLimit.toFixed(2)})\n${fitMsg}`,
    ).toBeLessThan(dominanceLimit);
  });

  it('items_processed is deterministic across reps for the same input', () => {
    // Confirms job-scheduling immunity directly: run the same input
    // three times and assert the count is byte-identical. If this
    // fails, the metric is being mutated by something outside the
    // algorithm's control (e.g. multi-threaded non-determinism).
    expect(binaryPath, 'binary path resolved').toBeTruthy();
    const source = synthesizeInput(10);
    const totals: number[] = [];
    for (let i = 0; i < 3; i++) {
      const report = runBinaryOnce(binaryPath!, catalogPath!, source);
      totals.push(
        (report.stage_metrics ?? []).reduce(
          (s, m) => s + (typeof m.items_processed === 'number' ? m.items_processed : 0),
          0,
        ),
      );
    }
    expect(totals[1], 'rep 2 matches rep 1').toBe(totals[0]);
    expect(totals[2], 'rep 3 matches rep 1').toBe(totals[0]);
  });
});

// Always-run guard: if either dependency is unavailable, surface that
// via a single explicit skip line in the vitest output so the operator
// sees WHY the suite is empty.
if (!canRun) {
  const missing = !binaryPath
    ? 'binary not built (set NEOTERRITORY_BIN or build under Codebase/Microservice/build-*)'
    : 'catalog not found (set NEOTERRITORY_CATALOG or place under Codebase/Microservice/pattern_catalog)';
  describe(`algorithm time complexity (skipped: ${missing})`, () => {
    it.skip('binary + catalog must both resolve', () => {
      /* unreachable */
    });
  });
}
