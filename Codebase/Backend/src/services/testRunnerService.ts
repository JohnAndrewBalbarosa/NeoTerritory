// Test-runner service. Compiles the user's source plus a pattern-specific
// pre-templated unit test, runs the resulting binary inside a sandbox, and
// reports pass/fail/timeout/segfault/leak/compile_error.
//
// Sandbox boundary is required because we run user-supplied C++. This file
// does NOT spawn a compiler unless ENABLE_TEST_RUNNER=1 *and* a sandbox
// command is configured via TEST_RUNNER_SANDBOX. Both must be set; the
// default state is "service unavailable" so a misconfigured deployment
// cannot accidentally expose an RCE surface.
//
// Recommended sandbox values:
//   - Linux:  TEST_RUNNER_SANDBOX="firejail --quiet --net=none --noprofile --rlimit-as=268435456 --timeout=00:00:10"
//   - macOS:  TEST_RUNNER_SANDBOX="sandbox-exec -p '(version 1)(deny default)(allow process-fork process-exec file-read*)'"
//   - Docker: TEST_RUNNER_SANDBOX="docker run --rm --network none --cpus 1 --memory 256m -v <RUN_DIR>:/work neoterritory-runner"
//
// See docs/TODO/test-runner-gdb.md for the full design.

import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import os from 'os';

// Each pattern is exercised in TWO sequential phases:
//  - 'compile_run': compile the user's class against a stub `int main()` and
//    run it. Tells the user "your class compiles and exits cleanly on its
//    own" before we attempt the unit-test driver.
//  - 'unit_test':   compile + run the per-pattern test template. Skipped
//    automatically when the compile_run phase already failed.
export type TestPhase = 'compile_run' | 'unit_test';
export interface TestResult {
  patternId: string;
  patternName: string;
  className: string;
  phase: TestPhase;
  passed: boolean;
  expected: string;
  actual: string;
  gdb?: string;
  exitCode: number;
  durationMs: number;
  verdict: 'pass' | 'fail' | 'timeout' | 'segfault' | 'leak' | 'compile_error' | 'sandbox_disabled' | 'no_template' | 'skipped';
  failingLine?: number;
  message?: string;
}

const TIMEOUT_MS = 10_000;

export function isTestRunnerEnabled(): boolean {
  if (process.env.ENABLE_TEST_RUNNER !== '1') return false;
  // Production refuses to run the compiled user code without an explicit
  // sandbox command — empty TEST_RUNNER_SANDBOX is treated as "not configured"
  // and the runner stays off so a misconfigured prod deployment cannot expose
  // an RCE surface. In dev we accept an empty sandbox (autoconfig may have
  // intentionally seeded it that way) and warn the developer once at boot.
  if (process.env.NODE_ENV === 'production'
      && (!process.env.TEST_RUNNER_SANDBOX || !process.env.TEST_RUNNER_SANDBOX.trim())) {
    return false;
  }
  return true;
}

// Track *why* the runner is currently off so the 503 detail message can be
// specific — "compiler not found on PATH" is far more actionable than the
// generic "set ENABLE_TEST_RUNNER=1".
let lastDisableReason: string =
  'Set ENABLE_TEST_RUNNER=1 and TEST_RUNNER_SANDBOX in the backend .env to enable.';
export function getDisableReason(): string {
  return lastDisableReason;
}

function hasOnPath(cmd: string): boolean {
  // Use the platform's lookup tool. spawnSync avoids inheriting our shell.
  const probe = process.platform === 'win32'
    ? spawnSync('where.exe', [cmd], { stdio: 'ignore' })
    : spawnSync('which', [cmd], { stdio: 'ignore' });
  return probe.status === 0;
}

function defaultSandboxForPlatform(): { sandbox: string; warning?: string } {
  if (process.platform === 'linux') {
    if (hasOnPath('firejail')) {
      return {
        sandbox: 'firejail --quiet --net=none --noprofile --rlimit-as=268435456'
      };
    }
    return {
      sandbox: '',
      warning: 'firejail not on PATH — runner enabled WITHOUT sandboxing. Dev only.'
    };
  }
  return {
    sandbox: '',
    warning: 'No host-native sandbox configured — runner enabled WITHOUT sandboxing. Dev only.'
  };
}

// One-shot autoconfig called once during server boot. Respects any explicit
// env override (so a deliberate ENABLE_TEST_RUNNER=0 stays off) and refuses
// to autoconfigure in production. Picks a g++ or clang++ off PATH and seeds
// a sane default sandbox per OS.
export function autoConfigureTestRunner(): void {
  const explicit = process.env.ENABLE_TEST_RUNNER;
  if (explicit === '0' || explicit === '1') {
    // Honour the explicit decision; only update the disable reason for ops.
    if (explicit === '0') lastDisableReason = 'ENABLE_TEST_RUNNER=0 in env.';
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    lastDisableReason = 'Production mode — set ENABLE_TEST_RUNNER=1 and TEST_RUNNER_SANDBOX explicitly.';
    // eslint-disable-next-line no-console
    console.log('[test-runner] disabled (production mode; explicit configuration required)');
    return;
  }
  const compiler = ['g++', 'clang++'].find(hasOnPath);
  if (!compiler) {
    lastDisableReason = 'No C++ compiler (g++ or clang++) found on PATH. Install one and restart, or set ENABLE_TEST_RUNNER=1 manually.';
    // eslint-disable-next-line no-console
    console.log('[test-runner] disabled (no compiler found on PATH)');
    return;
  }
  process.env.ENABLE_TEST_RUNNER = '1';
  if (!process.env.TEST_RUNNER_SANDBOX) {
    const { sandbox, warning } = defaultSandboxForPlatform();
    process.env.TEST_RUNNER_SANDBOX = sandbox;
    if (warning) {
      // eslint-disable-next-line no-console
      console.warn(`[test-runner] ${warning}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `[test-runner] enabled (compiler: ${compiler}, sandbox: ${process.env.TEST_RUNNER_SANDBOX || '(none)'})`
  );
}

function templatePath(patternId: string): string | null {
  // patternId is e.g. "structural.decorator" → catalog/structural/decorator.test.template.cpp
  const [family, name] = patternId.split('.');
  if (!family || !name) return null;
  const root = process.env.NEOTERRITORY_CATALOG
    || path.join(__dirname, '..', '..', '..', 'Microservice', 'pattern_catalog');
  const candidate = path.join(root, family, `${name}.test.template.cpp`);
  return fs.existsSync(candidate) ? candidate : null;
}

interface RunInputs {
  patternId: string;
  patternName: string;
  className: string;
  classText: string;
  // Full source bundle (all files joined) so the driver compiles even when
  // the targeted class depends on base classes / forward declarations / std
  // headers that don't appear inside its own classText snippet.
  fullSource?: string;
  // Per-file payload preserved verbatim with original filenames. When set,
  // each entry is dropped into the run dir under its original name so the
  // user's `#include "patterns.hpp"` resolves on disk; user_class.h then
  // becomes a thin shim that #include's each user file in submission order.
  files?: Array<{ name: string; sourceText: string }>;
  forwardMethod?: string;
  factoryFn?: string;
  terminator?: string;
  instanceAccessor?: string;
  componentBase?: string;
  realBase?: string;
  targetBase?: string;
  targetMethod?: string;
}

// Generous prelude — every common header users tend to assume is in scope.
// Prepended to user_class.h before the user's source so missing #include
// directives (very common when classText is a snippet, not a full file)
// don't break compilation. Adding extra headers is cheap.
const STANDARD_INCLUDES = `// --- NeoTerritory test runner: standard prelude ---
#include <cassert>
#include <cstdint>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
// --- end prelude ---
`;

// The user's source may declare its own `int main(...)`. We rename it via
// macro before including so it doesn't collide with the driver's main, then
// undefine the macro so the driver's main keeps the real symbol.
const MAIN_RENAME_OPEN = '#define main __neoterritory_user_main_disabled__\n';
const MAIN_RENAME_CLOSE = '#undef main\n';

function buildUserBundle(input: RunInputs): string {
  // Multi-file mode: each user file is written next to user_class.h with its
  // original name, so user_class.h just chains `#include "<name>"` directives
  // in submission order. This makes `#include "patterns.hpp"` resolve on
  // disk instead of failing because the sibling file lives only inside a
  // concatenated bundle string.
  if (input.files && input.files.length > 0) {
    const includes = input.files.map(f => `#include "${f.name}"`).join('\n');
    return `${STANDARD_INCLUDES}${MAIN_RENAME_OPEN}${includes}\n${MAIN_RENAME_CLOSE}`;
  }
  // Legacy / single-file path: inline the source directly.
  const body = (input.fullSource && input.fullSource.trim().length > 0)
    ? input.fullSource
    : input.classText;
  return `${STANDARD_INCLUDES}${MAIN_RENAME_OPEN}${body}\n${MAIN_RENAME_CLOSE}`;
}

// Sanitize a user-supplied filename so it's safe to write into runDir. We
// only allow basenames (no path separators, no ..) and clamp to a small set
// of C++ extensions; anything else is renamed to a numbered fallback.
function safeFileName(name: string, idx: number): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  if (/^[A-Za-z0-9._-]+$/.test(base) && /\.(cpp|cc|cxx|c|h|hpp|hxx|inl|ipp)$/i.test(base)) {
    return base;
  }
  return `user_file_${idx}.cpp`;
}

// Stub driver for the compile_run phase. Includes the user's full source so
// header-level errors surface; the bundle handles standard headers and
// renames any `int main` the user submitted so it doesn't collide with ours.
const COMPILE_RUN_DRIVER = `#include "user_class.h"
int main() { return 0; }
`;

// Path to the introspection helper bundled with the catalog. We copy it into
// each run dir so `#include "introspect.hpp"` from a template resolves.
function introspectHeaderPath(): string | null {
  const root = process.env.NEOTERRITORY_CATALOG
    || path.join(__dirname, '..', '..', '..', 'Microservice', 'pattern_catalog');
  const candidate = path.join(root, '_runtime', 'introspect.hpp');
  return fs.existsSync(candidate) ? candidate : null;
}

function fillTemplate(tpl: string, input: RunInputs): string {
  return tpl
    .replace(/{{HEADER}}/g, 'user_class.h')
    .replace(/{{CLASS_NAME}}/g, input.className)
    .replace(/{{FORWARD_METHOD}}/g, input.forwardMethod || 'execute')
    .replace(/{{FACTORY_FN}}/g, input.factoryFn || 'create')
    .replace(/{{TERMINATOR}}/g, input.terminator || 'build')
    .replace(/{{INSTANCE_ACCESSOR}}/g, input.instanceAccessor || 'instance')
    .replace(/{{COMPONENT_BASE}}/g, input.componentBase || 'Component')
    .replace(/{{REAL_BASE}}/g, input.realBase || 'Subject')
    .replace(/{{TARGET_BASE}}/g, input.targetBase || 'Target')
    .replace(/{{REQUEST_METHOD}}/g, input.forwardMethod || 'request')
    .replace(/{{TARGET_METHOD}}/g, input.targetMethod || 'execute');
}

interface PhaseInputs {
  driverSource: string;
  binaryName: string;
}

async function runPhase(
  phase: TestPhase,
  input: RunInputs,
  phaseInputs: PhaseInputs
): Promise<TestResult> {
  const t0 = Date.now();
  const base = {
    patternId: input.patternId,
    patternName: input.patternName,
    className: input.className,
    phase,
    expected: 'pass',
    actual: '',
    exitCode: 0,
    durationMs: 0
  };

  // Per-phase scratch dir keeps the user_class.h next to the driver but
  // isolates phase 1 from phase 2 (so phase 2 cannot reuse phase 1's binary).
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), `nt-${phase}-`));
  try {
    // Drop each submitted file into runDir using its original name first, so
    // any `#include "sibling.hpp"` the user wrote resolves to a real file on
    // disk. user_class.h then becomes a thin shim that chains them.
    if (input.files && input.files.length > 0) {
      const seen = new Set<string>();
      input.files.forEach((f, i) => {
        const name = safeFileName(f.name, i);
        // Defensive de-dupe: two entries with the same sanitized name would
        // otherwise overwrite each other and lose one of the files.
        if (seen.has(name)) return;
        seen.add(name);
        fs.writeFileSync(path.join(runDir, name), f.sourceText || '', 'utf8');
      });
      // Rebuild input.files in canonical sanitized form so buildUserBundle's
      // include directives reference the names actually on disk.
      input = { ...input, files: input.files.map((f, i) => ({ name: safeFileName(f.name, i), sourceText: f.sourceText || '' })) };
    }
    fs.writeFileSync(path.join(runDir, 'user_class.h'), buildUserBundle(input), 'utf8');
    // Drop the introspection middleman next to user_class.h. Templates
    // `#include "introspect.hpp"` to use the nt::has_*<T> probes.
    const introspect = introspectHeaderPath();
    if (introspect) {
      fs.copyFileSync(introspect, path.join(runDir, 'introspect.hpp'));
    }
    fs.writeFileSync(path.join(runDir, 'driver.cpp'), phaseInputs.driverSource, 'utf8');

    const sandboxCmd = (process.env.TEST_RUNNER_SANDBOX || '')
      .replace(/<RUN_DIR>/g, runDir);
    const sandboxParts = sandboxCmd.split(/\s+/).filter(Boolean);
    const binPath = path.join(runDir, phaseInputs.binaryName);
    const compileArgs = ['g++', '-std=c++17', '-O0', '-g',
                         path.join(runDir, 'driver.cpp'),
                         '-o', binPath];
    const compileOut = await runCmd([...sandboxParts, ...compileArgs], TIMEOUT_MS);
    if (compileOut.exitCode !== 0) {
      return {
        ...base,
        passed: false,
        verdict: 'compile_error',
        actual: compileOut.stderr || compileOut.stdout || 'compile failed',
        exitCode: compileOut.exitCode,
        message: phase === 'compile_run'
          ? 'Your class did not compile.'
          : 'Unit-test driver did not compile against the user class.',
        durationMs: Date.now() - t0
      };
    }
    const runOut = await runCmd([...sandboxParts, binPath], TIMEOUT_MS);
    const verdict: TestResult['verdict'] =
      runOut.timedOut         ? 'timeout' :
      runOut.exitCode === 0   ? 'pass' :
      runOut.signal === 'SIGSEGV' ? 'segfault' :
      'fail';
    const passMsg = phase === 'compile_run'
      ? 'Your class compiled and exited cleanly.'
      : 'All unit-test assertions held.';
    const failMsg = phase === 'compile_run'
      ? `Your class compiled but the binary exited with ${runOut.exitCode}.`
      : `Unit-test driver exited with ${runOut.exitCode}.`;
    return {
      ...base,
      passed: verdict === 'pass',
      verdict,
      actual: runOut.stdout + (runOut.stderr ? '\n--- stderr ---\n' + runOut.stderr : ''),
      exitCode: runOut.exitCode,
      durationMs: Date.now() - t0,
      message: verdict === 'pass' ? passMsg : failMsg
    };
  } finally {
    try { fs.rmSync(runDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// Run a single pattern's `unit_test` phase only. Used by the batched runner
// below: the submission's compile_run is shared across all patterns (it's
// the same code each time), so doing it per-pattern was N× wasted work.
export async function runPatternUnitTest(input: RunInputs): Promise<TestResult> {
  const tplPath = templatePath(input.patternId);
  if (!tplPath) {
    return {
      patternId:   input.patternId,
      patternName: input.patternName,
      className:   input.className,
      phase:       'unit_test',
      passed:      false,
      expected:    'pass',
      actual:      '',
      exitCode:    0,
      durationMs:  0,
      verdict:     'no_template',
      message:     `No unit-test template authored for ${input.patternId} yet.`
    };
  }
  return runPhase('unit_test', input, {
    driverSource: fillTemplate(fs.readFileSync(tplPath, 'utf8'), input),
    binaryName:   'unit_driver'
  });
}

// Run the submission-level `compile_run` phase once. The driver is identical
// across patterns (it just instantiates user code and exits 0), so its
// outcome is a property of the submission, not of any specific pattern.
export async function runSubmissionCompile(input: RunInputs): Promise<TestResult> {
  return runPhase('compile_run', input, {
    driverSource: COMPILE_RUN_DRIVER,
    binaryName:   'user_main'
  });
}

// Run both phases for one pattern. Phase 1 ('compile_run') always runs; phase
// 2 ('unit_test') is skipped with verdict 'skipped' when phase 1 already
// failed, so the user sees "we didn't even try the unit test because your
// class won't compile" instead of two confusingly identical compile errors.
export async function runPatternTest(input: RunInputs): Promise<TestResult[]> {
  const t0 = Date.now();
  const baseFor = (phase: TestPhase): TestResult => ({
    patternId: input.patternId,
    patternName: input.patternName,
    className: input.className,
    phase,
    passed: false,
    expected: 'pass',
    actual: '',
    exitCode: 0,
    durationMs: Date.now() - t0,
    verdict: 'skipped',
    message: ''
  });

  if (!isTestRunnerEnabled()) {
    const reason = `Test runner disabled. ${lastDisableReason}`;
    return [
      { ...baseFor('compile_run'), verdict: 'sandbox_disabled', message: reason },
      { ...baseFor('unit_test'),   verdict: 'sandbox_disabled', message: reason }
    ];
  }

  // Phase 1 — class-only compile + clean-exit run.
  const compileRunResult = await runPhase('compile_run', input, {
    driverSource: COMPILE_RUN_DRIVER,
    binaryName: 'user_main'
  });

  if (!compileRunResult.passed) {
    return [
      compileRunResult,
      { ...baseFor('unit_test'), verdict: 'skipped',
        message: 'Skipped — your class did not compile or did not exit cleanly on its own.' }
    ];
  }

  // Phase 2 — unit test driver, only if phase 1 passed.
  const tplPath = templatePath(input.patternId);
  if (!tplPath) {
    return [
      compileRunResult,
      { ...baseFor('unit_test'), verdict: 'no_template',
        message: `No unit-test template authored for ${input.patternId} yet.` }
    ];
  }
  const unitTestResult = await runPhase('unit_test', input, {
    driverSource: fillTemplate(fs.readFileSync(tplPath, 'utf8'), input),
    binaryName: 'unit_driver'
  });
  return [compileRunResult, unitTestResult];
}

interface CmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
  timedOut: boolean;
}

function runCmd(argv: string[], timeoutMs: number): Promise<CmdResult> {
  return new Promise<CmdResult>((resolve) => {
    if (argv.length === 0) {
      resolve({ stdout: '', stderr: 'empty argv', exitCode: 127, signal: null, timedOut: false });
      return;
    }
    const child = spawn(argv[0], argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout?.on('data', d => { stdout += d.toString(); });
    child.stderr?.on('data', d => { stderr += d.toString(); });
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(t);
      resolve({
        stdout, stderr,
        exitCode: code ?? 1,
        signal: signal ? String(signal) : null,
        timedOut
      });
    });
    child.on('error', (err) => {
      clearTimeout(t);
      resolve({ stdout: '', stderr: String(err), exitCode: 127, signal: null, timedOut: false });
    });
  });
}
