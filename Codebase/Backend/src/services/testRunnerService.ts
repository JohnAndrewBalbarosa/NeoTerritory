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

// Each pattern is exercised in THREE sequential phases:
//  - 'static_analysis': run cppcheck on the user's source. This is the
//    broad-base layer of the Testing Trophy (Dodds). Cheap, deterministic,
//    runs even when the code does not compile. Always runs first.
//  - 'compile_run': compile the user's class against a stub `int main()` and
//    run it. Tells the user "your class compiles and exits cleanly on its
//    own" before we attempt the unit-test driver.
//  - 'unit_test':   compile + run the per-pattern test template. Skipped
//    automatically when the compile_run phase already failed.
//
// Integration + E2E are deliberately NOT phases on this surface — see the
// trophy banner explainer in GdbRunnerTab for why: a single class
// declaration has no multi-module integration surface to exercise, and an
// E2E layer requires a deployed user-facing system that a class snippet
// does not provide. Those layers belong to the NeoTerritory product
// itself (the Playwright specs under Codebase/Frontend/playwright/).
export type TestPhase = 'static_analysis' | 'compile_run' | 'unit_test';
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
  // Plain-English criteria emitted by the driver via nt::emit_criterion.
  // Each row describes one assertion the test made (or skipped) so the UI
  // can render a per-criterion breakdown instead of just a binary verdict.
  criteria?: Array<{ status: 'pass' | 'skip' | 'fail'; description: string }>;
}

const COMPILE_TIMEOUT_MS = 10_000;
// 1-minute hard cap on the binary-execution phase. Anything longer is
// almost always either an infinite loop OR a program waiting on stdin
// the user didn't provide. The verdict surfaces both possibilities so
// the user knows where to look.
const RUN_TIMEOUT_MS = 60_000;
// Backwards-compat alias for the few callsites that still reference it.
const TIMEOUT_MS = COMPILE_TIMEOUT_MS;

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

function catalogRoot(): string {
  if (process.env.NEOTERRITORY_CATALOG) return process.env.NEOTERRITORY_CATALOG;
  // ts-node:  __dirname = Backend/src/services  (3 levels up → Codebase)
  // dist:     __dirname = Backend/dist/src/services  (4 levels up → Codebase)
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'Microservice', 'pattern_catalog'),
    path.join(__dirname, '..', '..', '..', '..', 'Microservice', 'pattern_catalog'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function templatePath(patternId: string): string | null {
  // patternId is e.g. "structural.decorator" → catalog/structural/decorator.test.template.cpp
  const [family, name] = patternId.split('.');
  if (!family || !name) return null;
  const candidate = path.join(catalogRoot(), family, `${name}.test.template.cpp`);
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
  // Owning user. When pod mode is on, the runner routes the compile + run
  // into this user's per-tester Docker container (services/podManager.ts);
  // otherwise this is a hint-only field. `undefined` falls back to local.
  userId?: number;
  // Optional stdin stream forwarded verbatim to the binary on the
  // run-binary phase (compile is unaffected). Newlines act as the user's
  // Enter key.
  stdin?: string;
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
  const candidate = path.join(catalogRoot(), '_runtime', 'introspect.hpp');
  return fs.existsSync(candidate) ? candidate : null;
}

// Templates splice these names into BOTH `nt::has_<name><T>` (the SFINAE
// probe) AND `obj.<name>()` (the runtime call). Anything that isn't a plain
// C++ identifier (e.g. "~Foo" for destructors, "operator()", "MyClass" for
// a constructor reused as a method name) would either fail to declare a
// trait or splice invalid syntax into the driver. Sanitize once here so
// every template in the catalog inherits the safety net.
function safeMember(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : fallback;
}

function fillTemplate(tpl: string, input: RunInputs): string {
  return tpl
    .replace(/{{HEADER}}/g, 'user_class.h')
    .replace(/{{CLASS_NAME}}/g, input.className)
    .replace(/{{FORWARD_METHOD}}/g, safeMember(input.forwardMethod, 'execute'))
    .replace(/{{FACTORY_FN}}/g, safeMember(input.factoryFn, 'create'))
    .replace(/{{TERMINATOR}}/g, safeMember(input.terminator, 'build'))
    .replace(/{{INSTANCE_ACCESSOR}}/g, safeMember(input.instanceAccessor, 'instance'))
    .replace(/{{COMPONENT_BASE}}/g, safeMember(input.componentBase, 'Component'))
    .replace(/{{REAL_BASE}}/g, safeMember(input.realBase, 'Subject'))
    .replace(/{{TARGET_BASE}}/g, safeMember(input.targetBase, 'Target'))
    .replace(/{{REQUEST_METHOD}}/g, safeMember(input.forwardMethod, 'request'))
    .replace(/{{TARGET_METHOD}}/g, safeMember(input.targetMethod, 'execute'));
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

    // Pod path — only used when the per-tester container is ALREADY up
    // (claimSeat fired ensurePod async on sign-in; the pod manager has had
    // wall-clock to spin one). We never await pod creation inside the
    // request path — that would let a slow Docker host block the GDB run
    // for tens of seconds. If the pod isn't ready, we fall through to the
    // local sandbox immediately and kick off ensurePod in the background
    // so the *next* request gets the pod.
    let pod: import('./podManager').PodHandle | null = null;
    if (input.userId !== undefined) {
      try {
        const pm = await import('./podManager');
        if (pm.isPodModeEnabled()) {
          pod = pm.getPod(input.userId);
          if (!pod) {
            // Fire-and-forget pod warm-up; the local sandbox handles this
            // request, the pod is ready by the next one.
            void pm.ensurePod(input.userId, `user-${input.userId}`).catch(() => {});
          }
        }
      } catch { /* fall through to local */ }
    }

    const sandboxCmd = (process.env.TEST_RUNNER_SANDBOX || '')
      .replace(/<RUN_DIR>/g, runDir);
    const sandboxParts = sandboxCmd.split(/\s+/).filter(Boolean);
    const binPath = path.join(runDir, phaseInputs.binaryName);

    if (pod) {
      const pm = await import('./podManager');
      const podRunDir = `/work/${path.basename(runDir)}`;
      // Best-effort: create the dir + copy each file the phase needs.
      await pm.execInPod(pod, ['mkdir', '-p', podRunDir], { timeoutMs: 5_000 });
      // Bulk-copy the whole runDir into the pod's /work/<basename>.
      const copyOk = await pm.copyIntoPod(pod, runDir, '/work/');
      if (copyOk) {
        const podDriver = `${podRunDir}/driver.cpp`;
        const podBin    = `${podRunDir}/${phaseInputs.binaryName}`;
        const compile = await pm.execInPod(pod,
          ['g++', '-std=c++17', '-O0', '-g', podDriver, '-o', podBin],
          { timeoutMs: COMPILE_TIMEOUT_MS });
        if (compile.exitCode !== 0) {
          // Distinguish a real g++ compile error (stderr contains a
          // diagnostic) from a docker/pod-side failure (empty stderr,
          // SIGKILL exit codes, or the wrapper exited non-zero before
          // g++ even ran). The latter is not the user's fault, and
          // falling back to the local sandbox gives them actual gcc
          // diagnostics instead of an opaque "compile failed".
          const diagnostic = (compile.stderr || compile.stdout || '').trim();
          const looksLikePodFailure =
            compile.timedOut ||
            compile.exitCode === 137 || compile.exitCode === 125 || compile.exitCode === -1 ||
            diagnostic.length === 0;
          if (!looksLikePodFailure) {
            return {
              ...base,
              passed: false,
              verdict: 'compile_error',
              actual: diagnostic,
              exitCode: compile.exitCode,
              message: phase === 'compile_run'
                ? 'Your class did not compile.'
                : 'Unit-test driver did not compile against the user class.',
              durationMs: Date.now() - t0
            };
          }
          // Pod-side failure — let the local sandbox path below produce
          // the real diagnostic. We deliberately do NOT return here.
          // eslint-disable-next-line no-console
          console.warn(`[test-runner] pod compile failed without diagnostic (exit=${compile.exitCode}, timedOut=${compile.timedOut}); falling back to local sandbox`);
          // Skip the pod run path and fall through to the sandbox compile.
        } else {
        const runOut = await pm.execInPod(pod, [podBin], {
          timeoutMs: RUN_TIMEOUT_MS,
          stdin: input.stdin
        });
        // If we hit the cap, kill the runaway process inside the pod —
        // execInPod's SIGKILL only ends the docker exec wrapper, the
        // binary keeps spinning. pkill is best-effort; if it itself
        // times out the sweep timer / next disposePod will reap the pod.
        if (runOut.timedOut) {
          await pm.execInPod(pod, ['pkill', '-9', '-f', phaseInputs.binaryName], { timeoutMs: 3_000 }).catch(() => {});
        }
        const verdictPod: TestResult['verdict'] =
          runOut.timedOut       ? 'timeout' :
          runOut.exitCode === 0 ? 'pass' :
          runOut.exitCode === 139 ? 'segfault' :
          'fail';
        const criteriaPod: NonNullable<TestResult['criteria']> = [];
        for (const ln of (runOut.stdout || '').split('\n')) {
          if (!ln.startsWith('NT_CRITERION ')) continue;
          const parts = ln.slice('NT_CRITERION '.length).split('|');
          if (parts.length < 4) continue;
          const status = parts[2] as 'pass' | 'skip' | 'fail';
          if (status !== 'pass' && status !== 'skip' && status !== 'fail') continue;
          criteriaPod.push({ status, description: parts.slice(3).join('|').trim() });
        }
        const cleanedStdoutPod = (runOut.stdout || '')
          .split('\n').filter(ln => !ln.startsWith('NT_CRITERION ')).join('\n');
        return {
          ...base,
          passed: verdictPod === 'pass',
          verdict: verdictPod,
          actual: cleanedStdoutPod + (runOut.stderr ? '\n--- stderr ---\n' + runOut.stderr : ''),
          exitCode: runOut.exitCode,
          durationMs: Date.now() - t0,
          message: verdictPod === 'pass'
            ? (phase === 'compile_run' ? 'Your class compiled and exited cleanly.' : 'All unit-test assertions held.')
            : verdictPod === 'timeout'
              ? `Process took too long (over ${RUN_TIMEOUT_MS / 1000}s). Check that your stdin is complete (the program may be waiting for input that wasn't provided), or that the code isn't spinning in a long loop.`
              : (phase === 'compile_run'
                  ? `Your class compiled but the binary exited with ${runOut.exitCode}.`
                  : `Unit-test driver exited with ${runOut.exitCode}.`),
          criteria: criteriaPod
        };
        }
      }
      // copy failed OR pod-side compile failure → fall through to local
      // sandbox path so the user doesn't lose the run because Docker
      // hiccupped, and so they get a real gcc diagnostic instead of an
      // opaque "compile failed".
    }

    const compileArgs = ['g++', '-std=c++17', '-O0', '-g',
                         path.join(runDir, 'driver.cpp'),
                         '-o', binPath];
    const compileOut = await runCmd([...sandboxParts, ...compileArgs], COMPILE_TIMEOUT_MS);
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
    const runOut = await runCmd([...sandboxParts, binPath], RUN_TIMEOUT_MS, input.stdin);
    const verdict: TestResult['verdict'] =
      runOut.timedOut         ? 'timeout' :
      runOut.exitCode === 0   ? 'pass' :
      runOut.signal === 'SIGSEGV' ? 'segfault' :
      'fail';
    const passMsg = phase === 'compile_run'
      ? 'Your class compiled and exited cleanly.'
      : 'All unit-test assertions held.';
    const failMsg = verdict === 'timeout'
      ? `Process took too long (over ${RUN_TIMEOUT_MS / 1000}s). Check that your stdin is complete (the program may be waiting for input that wasn't provided), or that the code isn't spinning in a long loop.`
      : phase === 'compile_run'
        ? `Your class compiled but the binary exited with ${runOut.exitCode}.`
        : `Unit-test driver exited with ${runOut.exitCode}.`;
    // Parse plain-English criteria emitted by the driver via nt::emit_criterion.
    // Each line: NT_CRITERION pattern_id|class|status|description
    const criteria: NonNullable<TestResult['criteria']> = [];
    for (const ln of (runOut.stdout || '').split('\n')) {
      if (!ln.startsWith('NT_CRITERION ')) continue;
      const parts = ln.slice('NT_CRITERION '.length).split('|');
      if (parts.length < 4) continue;
      const status = parts[2] as 'pass' | 'skip' | 'fail';
      if (status !== 'pass' && status !== 'skip' && status !== 'fail') continue;
      criteria.push({ status, description: parts.slice(3).join('|').trim() });
    }
    // Strip NT_CRITERION lines from the visible stdout — they're now
    // first-class criteria entries; leaving them in `actual` is noise.
    const cleanedStdout = (runOut.stdout || '')
      .split('\n')
      .filter(ln => !ln.startsWith('NT_CRITERION '))
      .join('\n');
    return {
      ...base,
      passed: verdict === 'pass',
      verdict,
      actual: cleanedStdout + (runOut.stderr ? '\n--- stderr ---\n' + runOut.stderr : ''),
      exitCode: runOut.exitCode,
      durationMs: Date.now() - t0,
      message: verdict === 'pass' ? passMsg : failMsg,
      criteria
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

// --- Static analysis phase (cppcheck) ---
//
// Runs cppcheck on the user's source as the broad-base layer of the
// Testing Trophy. Cppcheck is small (~5 MB), runs without requiring a
// successful compile, and reports issues on a per-line basis.
//
// Verdict semantics:
//   - 'pass'             — cppcheck ran, no findings.
//   - 'fail'             — cppcheck reported at least one `error`-severity
//                          finding (logic bugs, memory issues).
//   - 'sandbox_disabled' — cppcheck binary not on PATH. The phase reports
//                          its own disable reason without blocking the
//                          downstream compile_run + unit_test phases.
//   - Warnings + style + performance findings do NOT fail the phase by
//     themselves; they surface as `skip`-status criteria so the user sees
//     them without the run being marked red.
//
// The phase always runs first. It is intentionally non-fatal: a static
// finding never blocks compile_run or unit_test from executing, because
// the learner is still entitled to see whether their class actually
// compiles. The phases stream independently to the frontend via SSE.

const CPPCHECK_BIN = process.env.CPPCHECK_BIN || 'cppcheck';
// Bounded: cppcheck on a small classroom snippet should complete in <2s.
// A larger cap protects against pathological cases without holding up
// the rest of the pipeline.
const CPPCHECK_TIMEOUT_MS = 8_000;

interface CppcheckFinding {
  severity: 'error' | 'warning' | 'style' | 'performance' | 'portability' | 'information';
  line: number;
  message: string;
}

function parseCppcheckOutput(stdout: string, stderr: string): CppcheckFinding[] {
  // We emit findings via --template='{severity}|{line}|{message}'. They land
  // on stderr in cppcheck's default behaviour, but we accept stdout too in
  // case the tool's release version routes differently. One finding per
  // non-empty line.
  const findings: CppcheckFinding[] = [];
  const raw = `${stderr}\n${stdout}`;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|');
    if (parts.length < 3) continue;
    const severity = parts[0] as CppcheckFinding['severity'];
    const lineNo = Number.parseInt(parts[1], 10);
    const message = parts.slice(2).join('|').trim();
    if (!message) continue;
    findings.push({
      severity,
      line: Number.isFinite(lineNo) ? lineNo : 0,
      message,
    });
  }
  return findings;
}

export async function runStaticAnalysis(input: RunInputs): Promise<TestResult> {
  const t0 = Date.now();
  const base: TestResult = {
    patternId: input.patternId,
    patternName: input.patternName,
    className: input.className,
    phase: 'static_analysis',
    passed: false,
    expected: 'no error-level findings',
    actual: '',
    exitCode: 0,
    durationMs: 0,
    verdict: 'skipped',
  };

  // Cheap availability probe — does the cppcheck binary actually exist on
  // PATH? Without this we'd get a confusing ENOENT inside runCmd().
  const probe = spawnSync(CPPCHECK_BIN, ['--version'], { encoding: 'utf8' });
  if (probe.error || (probe.status !== 0 && probe.status !== null)) {
    return {
      ...base,
      verdict: 'sandbox_disabled',
      durationMs: Date.now() - t0,
      message:
        'cppcheck not installed in this runtime. The Testing Trophy base layer is unavailable on this deployment. ' +
        'Install cppcheck (apt-get install cppcheck) or set CPPCHECK_BIN to a working path.',
    };
  }

  // cppcheck 2.x rejects `-` as a stdin pseudo-filename, so we write the
  // submission to a tmp .cpp file and let the analyser pick up the extension.
  // The temp file is unlinked in `finally` regardless of cppcheck's outcome.
  const source = input.fullSource && input.fullSource.length > 0 ? input.fullSource : input.classText;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cppcheck-'));
  const tmpFile = path.join(tmpDir, 'submission.cpp');
  fs.writeFileSync(tmpFile, source, 'utf8');
  const argv = [
    CPPCHECK_BIN,
    '--enable=warning,style,performance,portability',
    '--inline-suppr',
    '--language=c++',
    '--std=c++17',
    '--quiet',
    "--template={severity}|{line}|{message}",
    tmpFile,
  ];
  let cmd;
  try {
    cmd = await runCmd(argv, CPPCHECK_TIMEOUT_MS);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* best-effort */ }
    try { fs.rmdirSync(tmpDir); } catch { /* best-effort */ }
  }
  const findings = parseCppcheckOutput(cmd.stdout, cmd.stderr);
  const errorFindings = findings.filter((f) => f.severity === 'error');
  const passed = errorFindings.length === 0;

  // Each finding becomes a criterion. error → fail; warning/style/etc → skip
  // (informational, never fails the phase by itself).
  const criteria: NonNullable<TestResult['criteria']> = findings.map((f) => ({
    status: f.severity === 'error' ? 'fail' : 'skip',
    description: `cppcheck (${f.severity}) line ${f.line}: ${f.message}`,
  }));
  // When the snippet is clean we still want a single positive criterion so
  // the UI shows something instead of an empty list.
  if (findings.length === 0) {
    criteria.push({
      status: 'pass',
      description: 'cppcheck ran on the submission and reported no findings.',
    });
  }

  return {
    ...base,
    passed,
    verdict: passed ? 'pass' : 'fail',
    durationMs: Date.now() - t0,
    exitCode: cmd.exitCode,
    actual: `${cmd.stdout}\n--- stderr ---\n${cmd.stderr}`.trim(),
    criteria,
    message: passed
      ? `cppcheck: ${findings.length} non-error finding${findings.length === 1 ? '' : 's'}.`
      : `cppcheck: ${errorFindings.length} error-severity finding${errorFindings.length === 1 ? '' : 's'}.`,
  };
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
      { ...baseFor('static_analysis'), verdict: 'sandbox_disabled', message: reason },
      { ...baseFor('compile_run'),     verdict: 'sandbox_disabled', message: reason },
      { ...baseFor('unit_test'),       verdict: 'sandbox_disabled', message: reason }
    ];
  }

  // Phase 0 — static analysis (cppcheck). Cheap, deterministic, always
  // runs. Findings are surfaced but do NOT block the downstream phases —
  // the learner is still entitled to see whether the class compiles even
  // when the analyser complained about style.
  const staticAnalysisResult = await runStaticAnalysis(input);

  // Phase 1 — class-only compile + clean-exit run.
  const compileRunResult = await runPhase('compile_run', input, {
    driverSource: COMPILE_RUN_DRIVER,
    binaryName: 'user_main'
  });

  if (!compileRunResult.passed) {
    return [
      staticAnalysisResult,
      compileRunResult,
      { ...baseFor('unit_test'), verdict: 'skipped',
        message: 'Skipped — your class did not compile or did not exit cleanly on its own.' }
    ];
  }

  // Phase 2 — unit test driver, only if phase 1 passed.
  const tplPath = templatePath(input.patternId);
  if (!tplPath) {
    return [
      staticAnalysisResult,
      compileRunResult,
      { ...baseFor('unit_test'), verdict: 'no_template',
        message: `No unit-test template authored for ${input.patternId} yet.` }
    ];
  }
  const unitTestResult = await runPhase('unit_test', input, {
    driverSource: fillTemplate(fs.readFileSync(tplPath, 'utf8'), input),
    binaryName: 'unit_driver'
  });
  return [staticAnalysisResult, compileRunResult, unitTestResult];
}

interface CmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
  timedOut: boolean;
}

function runCmd(argv: string[], timeoutMs: number, stdin?: string): Promise<CmdResult> {
  return new Promise<CmdResult>((resolve) => {
    if (argv.length === 0) {
      resolve({ stdout: '', stderr: 'empty argv', exitCode: 127, signal: null, timedOut: false });
      return;
    }
    // Pipe stdin so the binary can read from it. We always wire the
    // input stream — if the caller didn't pass any stdin string we
    // close it immediately so the program sees EOF instead of hanging
    // on cin >> x with nothing to read.
    const child = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
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
    if (stdin && stdin.length > 0) child.stdin?.write(stdin);
    child.stdin?.end();
  });
}
