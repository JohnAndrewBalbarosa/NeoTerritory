#!/usr/bin/env node
// CI gdb-runner smoke flow. Phase D of the CI requirement-compliance plan.
//
// Boots Codebase/Backend/dist/server.js on 127.0.0.1:3001, claims a tester
// seat, posts a Singleton snippet through /api/analyze, then drives
// /api/analysis/run-tests and verifies:
//   - results array is non-empty
//   - compile_run phase exists AND passed=true
//   - static_analysis phase exists AND verdict !== 'sandbox_disabled'
//
// The last assertion is the canary the cppcheck-stdin bug would have lit
// up before AWS shipped. It MUST be cppcheck-aware: the CI runner needs
// `apt-get install cppcheck` before invoking this script.
//
// Exit code 1 surfaces any failure to the CI step.

import { spawn } from 'node:child_process';

const BASE = 'http://127.0.0.1:3001';
let backend;

function stop() {
  if (backend && !backend.killed) backend.kill('SIGTERM');
}
process.on('exit', stop);

async function waitForBackend() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('backend not ready after 90s');
}

const CI_SINGLETON = `#include <string>
class CiTestSingleton {
public:
    static CiTestSingleton& getInstance() {
        static CiTestSingleton instance;
        return instance;
    }
    CiTestSingleton(const CiTestSingleton&) = delete;
    CiTestSingleton& operator=(const CiTestSingleton&) = delete;
private:
    CiTestSingleton() = default;
};`;

async function main() {
  backend = spawn('node', ['Codebase/Backend/dist/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '3001', HOST: '127.0.0.1' },
  });
  await waitForBackend();

  const acc = await fetch(`${BASE}/auth/test-accounts`).then((r) => r.json());
  if (!acc.accounts?.length) throw new Error('no tester accounts seeded (SEED_TEST_USERS=1)');

  const claim = await fetch(`${BASE}/auth/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: acc.accounts[0].username }),
  });
  if (!claim.ok) throw new Error(`claim failed: ${claim.status}`);
  const { token } = await claim.json();

  const analyze = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: 'ci_singleton.cpp', code: CI_SINGLETON }),
  });
  if (!analyze.ok) {
    const t = await analyze.text();
    throw new Error(`analyze failed: ${analyze.status} ${t}`);
  }
  const payload = await analyze.json();
  if (!payload.pendingId) throw new Error('pendingId missing from analyze response');

  // Structural assertion: the singleton class must be detected. This is
  // the contract D68 protects — if a refactor swaps Singleton→Factory
  // detection, this fails on the CI runner instead of in production.
  const detected = payload.detectedPatterns || [];
  const singletonHit = detected.find(
    (p) => p.className === 'CiTestSingleton' && /singleton/i.test(p.patternId || ''),
  );
  if (!singletonHit) {
    const summary = detected.map((p) => `${p.className}:${p.patternId}`).join(', ') || '(none)';
    throw new Error(`expected singleton detection on CiTestSingleton; saw: ${summary}`);
  }

  // Resolve ambiguities the analyze step left dangling.
  const countByClass = {};
  for (const p of detected) {
    if (p.className) countByClass[p.className] = (countByClass[p.className] || 0) + 1;
  }
  const classResolvedPatterns = {};
  for (const p of detected) {
    if (p.className && countByClass[p.className] > 1 && !classResolvedPatterns[p.className]) {
      classResolvedPatterns[p.className] = p.patternId;
    }
  }

  const runTests = await fetch(`${BASE}/api/analysis/run-tests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ pendingId: payload.pendingId, classResolvedPatterns, stdin: '' }),
  });
  if (!runTests.ok) {
    const t = await runTests.text();
    throw new Error(`run-tests failed: ${runTests.status} ${t}`);
  }
  const result = await runTests.json();
  if (!Array.isArray(result.results)) throw new Error('run-tests missing results array');
  if (result.results.length === 0) throw new Error('run-tests returned zero results');

  for (const r of result.results) {
    console.log(`[result] phase=${r.phase} verdict=${r.verdict} passed=${r.passed}`);
    if (!r.passed && r.actual) {
      console.log(`[result] actual: ${String(r.actual).substring(0, 500)}`);
    }
  }

  // compile_run must pass — minimum signal that the runner actually
  // executed our Singleton snippet.
  const compileRun = result.results.find((r) => r && r.phase === 'compile_run');
  if (!compileRun) throw new Error('run-tests did not execute compile_run phase');
  if (!compileRun.passed) {
    throw new Error(
      `compile_run phase failed (verdict=${compileRun.verdict}): ${compileRun.actual || compileRun.message || ''}`,
    );
  }

  // static_analysis must NOT be sandbox_disabled. This is the canary that
  // would have caught the cppcheck-stdin bug before it shipped to AWS.
  // sandbox_disabled = cppcheck binary not on PATH OR invocation rejected.
  // Either way, the Testing Trophy base layer is broken in this runtime
  // and the build must fail.
  const staticAnalysis = result.results.find((r) => r && r.phase === 'static_analysis');
  if (!staticAnalysis) throw new Error('run-tests did not execute static_analysis phase');
  if (staticAnalysis.verdict === 'sandbox_disabled') {
    throw new Error(
      `static_analysis is sandbox_disabled (${staticAnalysis.message || ''}). ` +
        'Install cppcheck on the CI runner (apt-get install -y cppcheck) ' +
        'or fix the runStaticAnalysis invocation in testRunnerService.ts.',
    );
  }
  if (staticAnalysis.verdict !== 'pass' && staticAnalysis.verdict !== 'fail') {
    throw new Error(
      `static_analysis verdict unexpected: ${staticAnalysis.verdict}. ` +
        'Expected pass or fail; got something the FE renders as "no template" or "skipped".',
    );
  }

  console.log(`GDB runner API flow passed. result count=${result.results.length}`);
  stop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
