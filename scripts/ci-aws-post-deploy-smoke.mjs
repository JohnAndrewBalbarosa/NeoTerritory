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

const BASE = (process.env.AWS_PUBLIC_URL || '').replace(/\/$/, '');
if (!BASE) {
  console.error('AWS_PUBLIC_URL env var is required.');
  process.exit(1);
}

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

async function getJson(path, init) {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${path} returned ${r.status}: ${t.slice(0, 500)}`);
  }
  return r.json();
}

async function main() {
  // 1. Health
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

  // 2. Tester accounts
  const acc = await getJson('/auth/test-accounts');
  if (!acc.accounts?.length) throw new Error('no tester accounts seeded on AWS');

  // 3. Claim
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
    // 4. Analyze
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

    // Resolve ambiguities the matcher left dangling.
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

    // 5. Run tests
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
      throw new Error(
        `compile_run regression on AWS (verdict=${compileRun?.verdict}): ${compileRun?.actual || compileRun?.message || ''}`,
      );
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
  } finally {
    // 6. Release the seat regardless of pass/fail so the pool stays drained.
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
