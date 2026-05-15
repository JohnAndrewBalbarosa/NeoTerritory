#!/usr/bin/env node
// Thesis-grade staggered soak simulator. Reads tools/thesis-sim/dataset.json,
// drives N tester accounts through the real HTTP surface on AWS at a real
// wall-clock pace so Supabase log timestamps span the full window. Survey
// answers are not random — they are pulled verbatim from the fixture.
//
// Env:
//   SOAK_BASE_URL         (default http://122.248.192.49)
//   SOAK_USER_COUNT       (default 10; clamped to dataset users)
//   SOAK_RUNS_PER_USER    (default 5; clamped to fixture runs)
//   SOAK_STAGGER_MS       (default 600000  = 10 min between user starts)
//   SOAK_HEARTBEAT_MS     (default 30000   = 30 s)
//   SOAK_FIXTURE          (default tools/thesis-sim/dataset.json)
//   SOAK_LOG_DIR          (default test-artifacts/soak-runs)
//   SOAK_THINK_OVERRIDE   (optional integer ms; forces think time, ignores fixture range)
//   SOAK_GAP_OVERRIDE     (optional integer ms; forces inter-run gap, ignores fixture range)

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL      = (process.env.SOAK_BASE_URL || 'http://122.248.192.49').replace(/\/$/, '');
const USER_COUNT    = Number(process.env.SOAK_USER_COUNT || 10);
const RUNS_PER_USER = Number(process.env.SOAK_RUNS_PER_USER || 5);
const STAGGER_MS    = Number(process.env.SOAK_STAGGER_MS || 10 * 60_000);
const HEARTBEAT_MS  = Number(process.env.SOAK_HEARTBEAT_MS || 30_000);
const FIXTURE_PATH  = process.env.SOAK_FIXTURE || 'tools/thesis-sim/dataset.json';
const LOG_DIR       = process.env.SOAK_LOG_DIR || 'test-artifacts/soak-runs';
const THINK_OVERRIDE = process.env.SOAK_THINK_OVERRIDE ? Number(process.env.SOAK_THINK_OVERRIDE) : null;
const GAP_OVERRIDE   = process.env.SOAK_GAP_OVERRIDE   ? Number(process.env.SOAK_GAP_OVERRIDE)   : null;

const SAMPLE_ROOT = 'Codebase/Microservice/samples';
const CONSENT_VERSION = '2026-05-15';

const dataset = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
// Recovery mode: SOAK_USERNAMES is a comma-separated list of usernames to
// re-run after a partial failure. When set, USER_COUNT is ignored and the
// simulator only drives the named users (still in 10-min stagger order).
const usernameFilter = (process.env.SOAK_USERNAMES || '').split(',').map((s) => s.trim()).filter(Boolean);
const allUsers = usernameFilter.length > 0
  ? dataset.users.filter((u) => usernameFilter.includes(u.username))
  : dataset.users.slice(0, USER_COUNT);

fs.mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(LOG_DIR, `soak-${stamp}.jsonl`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function logEvent(obj) {
  const row = { ts: new Date().toISOString(), ...obj };
  logStream.write(JSON.stringify(row) + '\n');
}

function pickInRange(range) {
  const [lo, hi] = range;
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function http(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  let status = 0;
  let json = null;
  let textBody = '';
  try {
    const resp = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    status = resp.status;
    textBody = await resp.text();
    try { json = JSON.parse(textBody); } catch { json = null; }
    return { status, json, text: textBody, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: 0, json: null, text: String(err), latencyMs: Date.now() - t0, error: err };
  }
}

// In-process registry of claimed seats so a Ctrl-C can release them all.
const claimedTokens = new Map(); // username -> token

async function releaseAllClaimed(reason) {
  const pending = [];
  for (const [username, token] of claimedTokens.entries()) {
    pending.push(
      http('POST', '/auth/disconnect', { token })
        .then((r) => {
          logEvent({ user: username, endpoint: '/auth/disconnect', status: r.status, latencyMs: r.latencyMs, reason });
        })
        .catch(() => {}),
    );
  }
  await Promise.all(pending);
}

process.on('SIGINT', async () => {
  console.warn('\n[soak] SIGINT — releasing all claimed seats…');
  await releaseAllClaimed('sigint');
  process.exit(130);
});

function startHeartbeat(ctx) {
  const interval = setInterval(async () => {
    const r = await authedHttp('POST', '/auth/heartbeat', { ctx });
    logEvent({ user: ctx.username, endpoint: '/auth/heartbeat', status: r.status, latencyMs: r.latencyMs });
  }, HEARTBEAT_MS);
  return () => clearInterval(interval);
}

// authedHttp: wrap http() with two recovery paths.
//   1) status === 0 (network blip / fetch terminated) → up to NETWORK_RETRIES
//      retries with linear backoff. The AWS Lightsail node intermittently
//      drops long-running connections under bot scanner load.
//   2) status === 401 (token revoked or backend restarted with a fresh JWT
//      secret) → one re-claim of the seat for this user, then retry.
const NETWORK_RETRIES = 3;
const NETWORK_BACKOFF_MS = 4000;

async function authedHttp(method, url, { ctx, body } = {}) {
  let resp;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    resp = await http(method, url, { token: ctx.token, body });
    if (resp.status !== 0) break;
    logEvent({ user: ctx.username, event: 'network_retry', endpoint: url, attempt: attempt + 1, latencyMs: resp.latencyMs });
    if (attempt < NETWORK_RETRIES) await sleep(NETWORK_BACKOFF_MS * (attempt + 1));
  }
  if (resp.status === 401 && !ctx.reclaimInFlight) {
    ctx.reclaimInFlight = true;
    try {
      logEvent({ user: ctx.username, event: 'token_reclaim_attempt', reason: '401_on_' + url });
      const claim = await http('POST', '/auth/claim', { body: { username: ctx.username } });
      if (claim.status === 200 && claim.json?.token) {
        ctx.token = claim.json.token;
        claimedTokens.set(ctx.username, ctx.token);
        logEvent({ user: ctx.username, event: 'token_reclaimed' });
        resp = await http(method, url, { token: ctx.token, body });
      } else {
        logEvent({ user: ctx.username, event: 'token_reclaim_failed', status: claim.status });
      }
    } finally {
      ctx.reclaimInFlight = false;
    }
  }
  return resp;
}

function loadSampleCode(samplePath, commentInject) {
  const full = path.join(SAMPLE_ROOT, samplePath);
  const original = fs.readFileSync(full, 'utf8');
  // Insert a per-user marker comment at the top so each analysis is
  // structurally distinct without altering the C++ semantics.
  return `${commentInject}\n${original}`;
}

async function runOneAnalysis(ctx, runFixture) {
  const code = loadSampleCode(runFixture.sample, runFixture.comment_inject);
  const filename = `${ctx.username}-${path.basename(runFixture.sample)}`;

  // 1. analyze
  const analyze = await authedHttp('POST', '/api/analyze', {
    ctx,
    body: { filename, code },
  });
  logEvent({
    user: ctx.username,
    endpoint: '/api/analyze',
    sample: runFixture.sample,
    status: analyze.status,
    latencyMs: analyze.latencyMs,
    pendingId: analyze.json?.pendingId,
  });
  if (analyze.status !== 200 || !analyze.json?.pendingId) {
    throw new Error(`analyze failed: ${analyze.status} ${analyze.text.slice(0, 200)}`);
  }

  // Resolve ambiguities: take the first detected pattern per class.
  const detected = Array.isArray(analyze.json.detectedPatterns) ? analyze.json.detectedPatterns : [];
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

  // 2. save → integer runId
  const save = await authedHttp('POST', '/api/runs/save', {
    ctx,
    body: { pendingId: analyze.json.pendingId, classResolvedPatterns },
  });
  logEvent({
    user: ctx.username,
    endpoint: '/api/runs/save',
    status: save.status,
    latencyMs: save.latencyMs,
    runId: save.json?.runId,
  });
  if (save.status !== 201 || !save.json?.runId) {
    throw new Error(`save failed: ${save.status} ${save.text.slice(0, 200)}`);
  }
  return save.json.runId;
}

async function runOneUser(userFixture, userIndex) {
  const { username } = userFixture;
  const userStart = Date.now();
  logEvent({ user: username, persona: userFixture.persona, event: 'user_start', userIndex });

  // 1. claim
  const claim = await http('POST', '/auth/claim', {
    body: { username },
  });
  logEvent({ user: username, endpoint: '/auth/claim', status: claim.status, latencyMs: claim.latencyMs });
  if (claim.status !== 200 || !claim.json?.token) {
    throw new Error(`claim failed: ${claim.status} ${claim.text.slice(0, 200)}`);
  }
  const ctx = { username, token: claim.json.token, reclaimInFlight: false };
  claimedTokens.set(username, ctx.token);

  const stopHeartbeat = startHeartbeat(ctx);
  try {
    // 2. consent
    const consent = await authedHttp('POST', '/api/survey/consent', {
      ctx,
      body: { version: CONSENT_VERSION },
    });
    logEvent({ user: username, endpoint: '/api/survey/consent', status: consent.status, latencyMs: consent.latencyMs });

    // 3. per-run cycles
    const runs = userFixture.runs.slice(0, RUNS_PER_USER);
    for (let i = 0; i < runs.length; i++) {
      const runFx = runs[i];
      const runId = await runOneAnalysis(ctx, runFx);

      // think time before the survey opens
      const thinkMs = THINK_OVERRIDE != null ? THINK_OVERRIDE : pickInRange(userFixture.think_time_ms_range);
      logEvent({ user: username, event: 'think', durationMs: thinkMs, runId });
      await sleep(thinkMs);

      const surveyRun = await authedHttp('POST', `/api/survey/run/${encodeURIComponent(runId)}`, {
        ctx,
        body: { ratings: runFx.ratings, openEnded: {} },
      });
      logEvent({
        user: username,
        endpoint: '/api/survey/run/:runId',
        runId,
        ratings: runFx.ratings,
        status: surveyRun.status,
        latencyMs: surveyRun.latencyMs,
      });
      if (surveyRun.status !== 201) {
        throw new Error(`survey/run/${runId} failed: ${surveyRun.status} ${surveyRun.text.slice(0, 200)}`);
      }

      if (i < runs.length - 1) {
        const gapMs = GAP_OVERRIDE != null ? GAP_OVERRIDE : pickInRange(userFixture.inter_run_gap_ms_range);
        logEvent({ user: username, event: 'inter_run_gap', durationMs: gapMs });
        await sleep(gapMs);
      }
    }

    // 4. session survey — profile (A.*) + Likert items merged into ratings.
    const sessionRatings = {
      ...userFixture.profile,
      ...userFixture.session_ratings,
    };
    const sessionResp = await authedHttp('POST', '/api/survey/session', {
      ctx,
      body: { ratings: sessionRatings, openEnded: {} },
    });
    logEvent({
      user: username,
      endpoint: '/api/survey/session',
      status: sessionResp.status,
      latencyMs: sessionResp.latencyMs,
      ratingsCount: Object.keys(sessionRatings).length,
    });
    if (sessionResp.status !== 201) {
      throw new Error(`survey/session failed: ${sessionResp.status} ${sessionResp.text.slice(0, 200)}`);
    }
  } finally {
    stopHeartbeat();
    const dc = await http('POST', '/auth/disconnect', { token: ctx.token });
    logEvent({ user: username, endpoint: '/auth/disconnect', status: dc.status, latencyMs: dc.latencyMs });
    claimedTokens.delete(username);
    logEvent({ user: username, event: 'user_end', durationMs: Date.now() - userStart });
  }
}

async function main() {
  console.log(`[soak] base=${BASE_URL} users=${allUsers.length} runsPerUser=${RUNS_PER_USER} staggerMs=${STAGGER_MS} log=${logPath}`);
  logEvent({ event: 'soak_start', baseUrl: BASE_URL, userCount: allUsers.length, runsPerUser: RUNS_PER_USER, staggerMs: STAGGER_MS, heartbeatMs: HEARTBEAT_MS });

  // Pre-flight: /api/health must be 200.
  const health = await http('GET', '/api/health');
  if (health.status !== 200) {
    throw new Error(`pre-flight /api/health returned ${health.status}: ${health.text.slice(0, 200)}`);
  }

  // Launch users one at a time with STAGGER_MS spacing between starts.
  // Earlier users keep running concurrently — each has its own seat.
  const inflight = [];
  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i];
    console.log(`[soak] launching user #${i + 1}/${allUsers.length}: ${u.username} (${u.persona})`);
    const p = runOneUser(u, i).catch((err) => {
      logEvent({ user: u.username, event: 'user_error', message: String(err && err.message || err) });
      console.error(`[soak] ${u.username} error:`, err && err.message);
    });
    inflight.push(p);
    if (i < allUsers.length - 1) {
      await sleep(STAGGER_MS);
    }
  }
  await Promise.all(inflight);
  logEvent({ event: 'soak_end' });
  console.log(`[soak] done. log=${logPath}`);
}

main().catch((err) => {
  console.error('[soak] fatal:', err);
  releaseAllClaimed('fatal').finally(() => process.exit(1));
});
