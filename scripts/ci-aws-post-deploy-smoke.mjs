#!/usr/bin/env node
// AWS post-deploy smoke. Phase E of the CI requirement-compliance plan.
//
// Runs AFTER deploy-aws against the live AWS host. Verifies:
//   1. /api/health → microservice.connected, testRunnerEnabled,
//      docker.online all === true.
//   2. /auth/test-accounts has at least one seeded tester.
//   3. /auth/claim succeeds and returns a JWT.
//   4. /api/analyze on a Singleton snippet detects singleton on the
//      named class (structural assertion — catches the
//      Singleton→Factory swap regression D68 protects).
//   5. /api/analysis/run-tests returns:
//        - compile_run with passed=true
//        - static_analysis with verdict !== 'sandbox_disabled'
//      The cppcheck assertion is the canary that would have caught the
//      cppcheck-stdin bug before users hit it.
//   6. /auth/disconnect releases the seat so the pool stays drained.
//
// Required env:
//   AWS_PUBLIC_URL — base URL of the live deployment (e.g.
//                    https://neoterritory.example.com or
//                    http://122.248.192.49). No trailing slash.
//
// runc / Docker-host flake retry:
//   The compile_run phase spawns a container on the AWS host. Docker's
//   runc occasionally trips on a stale network-namespace mount (e.g.
//   "Access error: ... /run/docker/netns/... invalid read-only mount"
//   or "cannot sync with peer: unexpected EOF"). The host needs a
//   `sudo systemctl restart docker` to clear the state; until that
//   happens, the smoke would email a CI failure for a problem the code
//   did not cause. To suppress that noise, compile_run failures whose
//   error text matches the runc-flake pattern are retried up to
//   COMPILE_RUN_MAX_RETRIES times with COMPILE_RUN_RETRY_DELAY_MS
//   between attempts. Non-flake failures still fail fast.
//   See docs/ops/aws-runc-flake.md for the host-side fix.

import { fileURLToPath } from 'node:url';

const BASE = (process.env.AWS_PUBLIC_URL || '').replace(/\/$/, '');

const CI_SINGLETON = `#include <string>
class AwsSmokeSingleton {
public:
    static AwsSmokeSingleton& getInstance() {
        static AwsSmokeSingleton instance;
        return instance;
    }
    AwsSmokeSingleton(const AwsSmokeSingleton&) = delete;
    AwsSmokeSingleton& operator=(const AwsSmokeSingleton&) = delete;
private:
    AwsSmokeSingleton() = default;
};`;

// Override knobs for the retry policy. Defaults match the recommendation
// in the prompt thread: at most 2 retries, 10s apart. Tests pass small
// values via env so the unit suite doesn't actually wait 10s.
const COMPILE_RUN_MAX_RETRIES = Number.parseInt(
  process.env.COMPILE_RUN_MAX_RETRIES ?? '2',
  10,
);
const COMPILE_RUN_RETRY_DELAY_MS = Number.parseInt(
  process.env.COMPILE_RUN_RETRY_DELAY_MS ?? '10000',
  10,
);

// Patterns that signal a Docker/runc host flake (NOT a code-side
// compile error). Hits any → the compile_run failure is retryable.
// Exported so the unit test can pin the matcher down.
export const RUNC_FLAKE_PATTERNS = Object.freeze([
  /\brunc\b/i,
  /invalid read-only mount/i,
  /cannot sync with peer.*unexpected eof/i,
  /\/run\/docker\/netns\//i,
  /\bnsfs\b/i,
  /peer .* unexpectedly exited with status/i,
]);

export function looksLikeRuncFlake(message) {
  if (typeof message !== 'string' || message.length === 0) return false;
  return RUNC_FLAKE_PATTERNS.some((re) => re.test(message));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(path, init) {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${path} returned ${r.status}: ${t.slice(0, 500)}`);
  }
  return r.json();
}

// One full analyze→run-tests cycle. Returns the compile_run / static_analysis
// rows on success; throws on hard failure. compile_run runc flakes are
// signalled via a thrown Error tagged with `error.runcFlake = true` so the
// outer retry loop knows to back off and try again.
async function attemptCompileSequence(token) {
  const analyze = await getJson('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: 'aws_smoke.cpp', code: CI_SINGLETON }),
  });
  const detected = analyze.detectedPatterns || [];
  const singletonHit = detected.find(
    (p) => p.className === 'AwsSmokeSingleton' && /singleton/i.test(p.patternId || ''),
  );
  if (!singletonHit) {
    const summary = detected.map((p) => `${p.className}:${p.patternId}`).join(', ') || '(none)';
    throw new Error(`expected singleton detection on AwsSmokeSingleton; saw: ${summary}`);
  }
  console.log(`[analyze] pendingId=${analyze.pendingId} singleton=detected`);

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

  const runTests = await getJson('/api/analysis/run-tests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ pendingId: analyze.pendingId, classResolvedPatterns, stdin: '' }),
  });
  if (!Array.isArray(runTests.results) || runTests.results.length === 0) {
    throw new Error('run-tests returned empty results');
  }
  for (const r of runTests.results) {
    console.log(`[run-tests] phase=${r.phase} verdict=${r.verdict} passed=${r.passed}`);
  }

  const compileRun = runTests.results.find((r) => r && r.phase === 'compile_run');
  if (!compileRun || !compileRun.passed) {
    const message = `${compileRun?.actual || ''} ${compileRun?.message || ''}`.trim();
    const err = new Error(
      `compile_run regression on AWS (verdict=${compileRun?.verdict}): ${message}`,
    );
    err.runcFlake = looksLikeRuncFlake(message);
    err.verdict = compileRun?.verdict;
    throw err;
  }
  const staticAnalysis = runTests.results.find((r) => r && r.phase === 'static_analysis');
  if (!staticAnalysis) throw new Error('static_analysis phase missing on AWS');
  if (staticAnalysis.verdict === 'sandbox_disabled') {
    throw new Error(
      `static_analysis is sandbox_disabled on AWS (${staticAnalysis.message || ''}). ` +
        'Install cppcheck on the host (sudo apt-get install -y cppcheck) ' +
        'or repair the runStaticAnalysis invocation.',
    );
  }
  if (staticAnalysis.verdict !== 'pass' && staticAnalysis.verdict !== 'fail') {
    throw new Error(
      `static_analysis verdict unexpected on AWS: ${staticAnalysis.verdict}. ` +
        'Expected pass/fail; got skipped/no_template — the Testing Trophy base layer is degraded.',
    );
  }
  return { compileRun, staticAnalysis };
}

async function runCompileSequenceWithRetry(token, opts = {}) {
  const maxRetries = opts.maxRetries ?? COMPILE_RUN_MAX_RETRIES;
  const retryDelayMs = opts.retryDelayMs ?? COMPILE_RUN_RETRY_DELAY_MS;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await attemptCompileSequence(token);
    } catch (err) {
      lastErr = err;
      const retryable = err && err.runcFlake === true;
      if (!retryable || attempt === maxRetries) break;
      const preview = String(err.message || '').slice(0, 200);
      console.warn(
        `[retry ${attempt + 1}/${maxRetries}] runc flake detected on compile_run; ` +
          `sleeping ${retryDelayMs}ms before retry. cause: ${preview}`,
      );
      await sleep(retryDelayMs);
    }
  }
  throw lastErr;
}

async function main() {
  if (!BASE) {
    console.error('AWS_PUBLIC_URL env var is required.');
    process.exit(1);
  }

  const health = await getJson('/api/health');
  const failures = [];
  if (!health.microservice?.connected) failures.push('microservice.connected=false');
  if (!health.testRunnerEnabled) failures.push('testRunnerEnabled=false');
  if (!health.docker?.online) failures.push('docker.online=false');
  if (failures.length) {
    throw new Error(`/api/health regressed: ${failures.join(', ')}`);
  }
  console.log(
    `[health] ms=${health.microservice.connected} runner=${health.testRunnerEnabled} ` +
      `docker=${health.docker?.online} model=${health.aiModel}`,
  );

  const acc = await getJson('/auth/test-accounts');
  if (!acc.accounts?.length) throw new Error('no tester accounts seeded on AWS');

  const target = acc.accounts.find((a) => !a.claimed) || acc.accounts[0];
  const claim = await getJson('/auth/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: target.username }),
  });
  if (!claim?.token) throw new Error('claim returned no token');
  const token = claim.token;
  console.log(`[claim] username=${target.username}`);

  try {
    await runCompileSequenceWithRetry(token);
  } finally {
    try {
      await fetch(`${BASE}/auth/disconnect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: target.username }),
      });
      console.log(`[disconnect] released ${target.username}`);
    } catch (e) {
      console.warn(`[disconnect] failed: ${e?.message}`);
    }
  }

  console.log('AWS post-deploy smoke: PASS.');
}

// Run only when invoked directly, so the unit test can import this
// module without triggering a network call.
const isMain = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { attemptCompileSequence, runCompileSequenceWithRetry, sleep };
