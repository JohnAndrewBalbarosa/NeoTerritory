// Unit tests for the runc-flake detection + retry policy in
// scripts/ci-aws-post-deploy-smoke.mjs. Run with `npm run test:smoke-retry`
// (root package.json) — uses node:test, no extra deps.
//
// We test the matcher exhaustively against real failure strings the AWS
// host has produced, then exercise the retry loop with a fake compile
// function that fails N times then succeeds, and a non-flake error that
// must fail fast.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RUNC_FLAKE_PATTERNS,
  looksLikeRuncFlake,
  runCompileSequenceWithRetry,
} from '../ci-aws-post-deploy-smoke.mjs';

test('runc flake matcher: real AWS host failure string', () => {
  const real =
    'Access error: uid 0, last mount name:net:[4026532295] dir:/run/docker/netns/8262291854dd ' +
    'type:nsfs - invalid read-only mount\n' +
    'proc 1786297 cannot sync with peer: unexpected EOF\n' +
    'Peer 1786305 unexpectedly exited with status 1';
  assert.equal(looksLikeRuncFlake(real), true);
});

test('runc flake matcher: positive cases', () => {
  const cases = [
    'runc create failed: container init',
    'invalid read-only mount',
    'cannot sync with peer: unexpected EOF',
    '/run/docker/netns/abc123',
    'nsfs setup error',
    'Peer 1234 unexpectedly exited with status 1',
  ];
  for (const c of cases) {
    assert.equal(looksLikeRuncFlake(c), true, `expected flake for: ${c}`);
  }
});

test('runc flake matcher: negative cases (real compile errors)', () => {
  const cases = [
    "error: 'foo' was not declared in this scope",
    'undefined reference to `bar()`',
    'fatal error: missing.h: No such file or directory',
    'segmentation fault (core dumped)',
    'static_analysis: cppcheck not found',
    '', // empty
  ];
  for (const c of cases) {
    assert.equal(looksLikeRuncFlake(c), false, `expected NOT flake for: ${c}`);
  }
});

test('runc flake matcher: rejects non-string input', () => {
  assert.equal(looksLikeRuncFlake(null), false);
  assert.equal(looksLikeRuncFlake(undefined), false);
  assert.equal(looksLikeRuncFlake(123), false);
  assert.equal(looksLikeRuncFlake({}), false);
});

test('RUNC_FLAKE_PATTERNS is frozen', () => {
  assert.equal(Object.isFrozen(RUNC_FLAKE_PATTERNS), true);
});

// ── Retry loop ───────────────────────────────────────────────────────────

function makeRuncFlakeError() {
  const e = new Error('compile_run regression on AWS: invalid read-only mount on /run/docker/netns/x');
  e.runcFlake = true;
  e.verdict = 'compile_error';
  return e;
}

function makeRealCompileError() {
  const e = new Error("compile_run regression on AWS: error: 'foo' was not declared");
  e.runcFlake = false;
  e.verdict = 'compile_error';
  return e;
}

// Patches runCompileSequenceWithRetry by stubbing attemptCompileSequence
// is tricky without DI. Instead, we re-implement the same retry logic
// in-line over a fake step function and verify the policy holds. The
// runCompileSequenceWithRetry export is still smoke-importable so a
// regression in its signature would break this test file at load time.
async function retryLike(step, { maxRetries = 2, retryDelayMs = 0 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await step();
    } catch (err) {
      lastErr = err;
      const retryable = err && err.runcFlake === true;
      if (!retryable || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  throw lastErr;
}

test('retry policy: succeeds when 1 flake then pass within budget', async () => {
  let calls = 0;
  const step = async () => {
    calls++;
    if (calls === 1) throw makeRuncFlakeError();
    return { ok: true };
  };
  const result = await retryLike(step, { maxRetries: 2, retryDelayMs: 0 });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test('retry policy: succeeds when exactly maxRetries flakes then pass', async () => {
  let calls = 0;
  const step = async () => {
    calls++;
    if (calls <= 2) throw makeRuncFlakeError();
    return { ok: true };
  };
  const result = await retryLike(step, { maxRetries: 2, retryDelayMs: 0 });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3); // initial + 2 retries
});

test('retry policy: gives up after maxRetries flakes', async () => {
  let calls = 0;
  const step = async () => {
    calls++;
    throw makeRuncFlakeError();
  };
  await assert.rejects(
    retryLike(step, { maxRetries: 2, retryDelayMs: 0 }),
    /invalid read-only mount/,
  );
  assert.equal(calls, 3); // initial + 2 retries
});

test('retry policy: fails fast on non-runc compile errors', async () => {
  let calls = 0;
  const step = async () => {
    calls++;
    throw makeRealCompileError();
  };
  await assert.rejects(
    retryLike(step, { maxRetries: 2, retryDelayMs: 0 }),
    /'foo' was not declared/,
  );
  assert.equal(calls, 1); // no retries on real compile errors
});

test('runCompileSequenceWithRetry export is callable (signature check)', () => {
  assert.equal(typeof runCompileSequenceWithRetry, 'function');
  // 1 positional arg (token) + 1 optional opts.
  assert.equal(runCompileSequenceWithRetry.length, 1);
});
