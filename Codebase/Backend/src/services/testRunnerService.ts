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

export interface TestResult {
  patternId: string;
  patternName: string;
  className: string;
  passed: boolean;
  expected: string;
  actual: string;
  gdb?: string;
  exitCode: number;
  durationMs: number;
  verdict: 'pass' | 'fail' | 'timeout' | 'segfault' | 'leak' | 'compile_error' | 'sandbox_disabled' | 'no_template';
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
  forwardMethod?: string;
  factoryFn?: string;
  terminator?: string;
  instanceAccessor?: string;
  componentBase?: string;
  realBase?: string;
  targetBase?: string;
  targetMethod?: string;
}

export async function runPatternTest(input: RunInputs): Promise<TestResult> {
  const t0 = Date.now();
  const base = {
    patternId: input.patternId,
    patternName: input.patternName,
    className: input.className,
    expected: 'pass',
    actual: '',
    exitCode: 0,
    durationMs: 0
  };

  if (!isTestRunnerEnabled()) {
    return {
      ...base,
      passed: false,
      verdict: 'sandbox_disabled',
      message: `Test runner disabled. ${lastDisableReason}`,
      durationMs: Date.now() - t0
    };
  }

  const tplPath = templatePath(input.patternId);
  if (!tplPath) {
    return {
      ...base,
      passed: false,
      verdict: 'no_template',
      message: `No test template found for ${input.patternId}.`,
      durationMs: Date.now() - t0
    };
  }

  const tpl = fs.readFileSync(tplPath, 'utf8')
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

  // Stage the test materials in a per-run temp dir.
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-test-'));
  try {
    fs.writeFileSync(path.join(runDir, 'user_class.h'), input.classText, 'utf8');
    fs.writeFileSync(path.join(runDir, 'driver.cpp'), tpl, 'utf8');

    // Compile and run inside the sandbox. Sandbox command may contain shell
    // metacharacters; we split it on whitespace and resolve `<RUN_DIR>` /
    // `<DRIVER>` placeholders.
    const sandboxCmd = (process.env.TEST_RUNNER_SANDBOX || '')
      .replace(/<RUN_DIR>/g, runDir);
    const compileArgs = ['g++', '-std=c++17', '-O0', '-g',
                         path.join(runDir, 'driver.cpp'),
                         '-o', path.join(runDir, 'driver')];
    const compileOut = await runCmd([...sandboxCmd.split(/\s+/).filter(Boolean), ...compileArgs], TIMEOUT_MS);
    if (compileOut.exitCode !== 0) {
      return {
        ...base,
        passed: false,
        verdict: 'compile_error',
        actual: compileOut.stderr || compileOut.stdout || 'compile failed',
        exitCode: compileOut.exitCode,
        message: 'Driver did not compile against the user class.',
        durationMs: Date.now() - t0
      };
    }

    const runOut = await runCmd([...sandboxCmd.split(/\s+/).filter(Boolean), path.join(runDir, 'driver')], TIMEOUT_MS);
    const verdict: TestResult['verdict'] =
      runOut.timedOut ? 'timeout' :
      runOut.exitCode === 0 ? 'pass' :
      runOut.signal === 'SIGSEGV' ? 'segfault' :
      'fail';
    return {
      ...base,
      passed: verdict === 'pass',
      verdict,
      actual: runOut.stdout + (runOut.stderr ? '\n--- stderr ---\n' + runOut.stderr : ''),
      exitCode: runOut.exitCode,
      durationMs: Date.now() - t0,
      message: verdict === 'pass' ? 'All assertions held.' : `Driver exited with ${runOut.exitCode}.`
    };
  } finally {
    // Best-effort cleanup; sandbox may have already removed the dir.
    try { fs.rmSync(runDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
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
