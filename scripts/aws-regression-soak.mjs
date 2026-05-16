#!/usr/bin/env node
// Variable-token-count regression run against AWS. Distinct from the
// soak simulator: this one's only job is to populate the analysis_runs
// table with widely-varying token counts so the admin's
// /api/admin/stats/complexity-data regression has a spread the OLS fit
// can actually find a slope on.
//
// What it does, end-to-end:
//   1. Claim a single tester seat (devcon30 by default — least-used).
//   2. Loop through a list of target token counts spanning ~50..2500
//      (the validator caps per-file at 500 tokens × ≤5 files = 2500).
//   3. For each target, synthesise a small C++ file from scratch (no
//      reuse of Codebase/Microservice/samples — generated per-call so
//      the analyser sees a fresh hash on every submission).
//   4. POST /api/analyze and let the server save the analysis_runs row.
//      Token count is what the microservice records; processing time
//      is the sum of stage_metrics ms which is what the admin
//      regression endpoint reads.
//   5. Repeat each target REPS times.
//   6. Disconnect, releasing the seat.

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL    = (process.env.SOAK_BASE_URL || 'http://122.248.192.49').replace(/\/$/, '');
const USERNAME    = process.env.SOAK_REGRESSION_USERNAME || 'devcon30';
// REPS defaults to 1 when targets are auto-generated (random distinct
// token counts) so the scatter has one point per unique x. When an
// explicit SOAK_REGRESSION_TARGETS list is passed, default to 6 reps
// per target — the historical behaviour for stepped scatters.
const HAS_EXPLICIT_TARGETS = Boolean((process.env.SOAK_REGRESSION_TARGETS || '').trim());
const REPS        = Number(process.env.SOAK_REGRESSION_REPS || (HAS_EXPLICIT_TARGETS ? 6 : 1));
const HEARTBEAT_MS = Number(process.env.SOAK_HEARTBEAT_MS || 30_000);
const LOG_DIR     = 'test-artifacts/soak-runs';

// Token-target generation. Two modes:
//   * SOAK_REGRESSION_TARGETS = "n1,n2,n3,..." — explicit list of target
//     token counts to hit (each repeated SOAK_REGRESSION_REPS times). Use
//     this when you want a clean stepped scatter at known x values.
//   * SOAK_REGRESSION_TARGETS unset (default) — generate
//     SOAK_REGRESSION_N random token counts uniformly distributed across
//     [SOAK_REGRESSION_MIN, SOAK_REGRESSION_MAX]. Every call gets a
//     DISTINCT x value, so the regression scatter is never concentrated
//     at a small set of x's. This is what the supervisor asked for:
//     'paiba iba ng per test ah pati narin tokens'.
const SOAK_REGRESSION_MIN = Number(process.env.SOAK_REGRESSION_MIN || 100);
const SOAK_REGRESSION_MAX = Number(process.env.SOAK_REGRESSION_MAX || 22000);
const SOAK_REGRESSION_N = Number(process.env.SOAK_REGRESSION_N || 96);
const TOKEN_TARGETS = (() => {
  const raw = (process.env.SOAK_REGRESSION_TARGETS || '').trim();
  if (raw) return raw.split(',').map(Number);
  let seed = (Date.now() & 0xffffffff) >>> 0;
  const r = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const span = SOAK_REGRESSION_MAX - SOAK_REGRESSION_MIN;
  return Array.from({ length: SOAK_REGRESSION_N }, () =>
    Math.round(SOAK_REGRESSION_MIN + r() * span)
  );
})();

fs.mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(LOG_DIR, `regression-${stamp}.jsonl`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function logEvent(obj) {
  logStream.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

async function http(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    return { status: resp.status, json, text, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: 0, json: null, text: String(err), latencyMs: Date.now() - t0 };
  }
}

// Token estimator — must mirror the backend's
// `Codebase/Backend/src/payloadValidator/common/index.ts:estimateTokens`
// closely enough that we can predict whether a synthesised file lands
// under the 500-token-per-file cap. The matcher counts identifiers,
// numbers, and single non-whitespace punctuation chars.
function countTokens(text) {
  const m = text.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s\w]/g);
  return m ? m.length : 0;
}

// Generate a C++ source body sized to approxTokens. Strategy: emit N
// complete Singleton classes back-to-back, each ~50 tokens. This makes
// the analyser's per-class pattern dispatch loop scale linearly with
// requested token count: 1 large class with many filler methods is one
// unit of per-class work, but 30 separate classes is 30 units. Mirrors
// how a real codebase grows — more files mean more classes mean more
// analyser work per submission.
// Empirically, each class emitted below counts ~70 tokens by the
// admin-side tokenizer. Keep this constant in sync with the backend's
// estimateTokens regex.
const TOKENS_PER_CLASS = 70;

function synthesizeFile(approxTokens, salt) {
  const classCount = Math.max(1, Math.ceil(approxTokens / TOKENS_PER_CLASS));
  let out = '#include <string>\n\n';
  for (let i = 0; i < classCount; i++) {
    const name = `Gen_${salt}_${i}`;
    out +=
      `class ${name} {\npublic:\n` +
      `    static ${name}& instance() { static ${name} s; return s; }\n` +
      `    ${name}(const ${name}&) = delete;\n` +
      `    ${name}& operator=(const ${name}&) = delete;\n` +
      `    int value() const { return ${i}; }\n` +
      `private:\n` +
      `    ${name}() = default;\n` +
      `};\n\n`;
  }
  return out;
}

// Per-file cap is MAX_TOKENS_PER_FILE (raised to 5000 for the empirical
// regression study — see Codebase/Backend/src/payloadValidator/common/
// index.ts). With each synthesized class costing ~70 tokens that's
// ≤ 70 classes per file. Budget 60 classes / ~4200 tokens per file
// for headroom. With max 5 files that gives ~300 classes / ~21k tokens
// total — comfortably inside the validator and into the linear-cost
// regime where per-token variable cost dominates the catalog floor.
const PER_FILE_BUDGET_TOKENS = 4200;
const MAX_FILES = 5;

function buildAnalyzeBody(targetTokens, salt) {
  if (targetTokens <= PER_FILE_BUDGET_TOKENS) {
    const code = synthesizeFile(targetTokens, salt);
    return { code, filename: `gen_${salt}.cpp`, actualTokens: countTokens(code) };
  }
  const fileCount = Math.min(MAX_FILES, Math.ceil(targetTokens / PER_FILE_BUDGET_TOKENS));
  const tokensPerFile = Math.min(PER_FILE_BUDGET_TOKENS, Math.floor(targetTokens / fileCount));
  const files = [];
  for (let i = 0; i < fileCount; i++) {
    const code = synthesizeFile(tokensPerFile, `${salt}_${i}`);
    files.push({ name: `gen_${salt}_${i}.cpp`, code });
  }
  const totalTokens = files.reduce((a, f) => a + countTokens(f.code), 0);
  return { files, actualTokens: totalTokens };
}

let heartbeatHandle = null;
function startHeartbeat(token) {
  heartbeatHandle = setInterval(async () => {
    const r = await http('POST', '/auth/heartbeat', { token });
    logEvent({ event: 'heartbeat', status: r.status });
  }, HEARTBEAT_MS);
}
function stopHeartbeat() { if (heartbeatHandle) clearInterval(heartbeatHandle); }

async function reclaimToken() {
  // If JWT secret rotated mid-session, fall back to /auth/login with
  // the seeded password.
  const c = await http('POST', '/auth/claim', { body: { username: USERNAME } });
  if (c.status === 200 && c.json?.token) return c.json.token;
  if (c.status === 409) {
    const l = await http('POST', '/auth/login', { body: { username: USERNAME, password: 'devcon' } });
    if (l.status === 200 && l.json?.token) return l.json.token;
  }
  return null;
}

async function main() {
  console.log(`[reg] base=${BASE_URL} user=${USERNAME} reps=${REPS} targets=${TOKEN_TARGETS.join(',')} log=${logPath}`);
  logEvent({ event: 'reg_start', baseUrl: BASE_URL, username: USERNAME, reps: REPS, targets: TOKEN_TARGETS });

  const health = await http('GET', '/api/health');
  if (health.status !== 200) {
    throw new Error(`pre-flight /api/health returned ${health.status}: ${health.text.slice(0, 200)}`);
  }

  const claim = await http('POST', '/auth/claim', { body: { username: USERNAME } });
  if (claim.status !== 200 || !claim.json?.token) {
    throw new Error(`claim ${USERNAME} failed: ${claim.status} ${claim.text.slice(0, 200)}`);
  }
  let token = claim.json.token;
  logEvent({ event: 'claim_ok', status: claim.status });

  startHeartbeat(token);
  let runsOk = 0;
  let runsErr = 0;
  try {
    // Randomise the order so any host-side warmup doesn't bias the
    // small-target rows. Each (target, rep) is one analyze call.
    const sequence = [];
    for (const t of TOKEN_TARGETS) {
      for (let r = 0; r < REPS; r++) sequence.push({ target: t, rep: r });
    }
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }
    for (let i = 0; i < sequence.length; i++) {
      const { target, rep } = sequence[i];
      const salt = `t${target}r${rep}_${Date.now().toString(36)}`;
      const body = buildAnalyzeBody(target, salt);
      let resp = await http('POST', '/api/analyze', { token, body });
      if (resp.status === 401) {
        const fresh = await reclaimToken();
        if (fresh) { token = fresh; resp = await http('POST', '/api/analyze', { token, body }); }
      }
      logEvent({
        event: 'analyze',
        targetTokens: target,
        actualTokens: body.actualTokens,
        rep,
        status: resp.status,
        latencyMs: resp.latencyMs,
        pendingId: resp.json?.pendingId,
        detectedCount: Array.isArray(resp.json?.detectedPatterns) ? resp.json.detectedPatterns.length : 0,
      });
      if (resp.status !== 200 || !resp.json?.pendingId) {
        runsErr += 1;
        console.warn(`[reg] ${target}t r${rep}: analyze ${resp.status} ${resp.text.slice(0, 120)}`);
        continue;
      }
      // Save the run so it lands in analysis_runs (the regression source).
      const save = await http('POST', '/api/runs/save', {
        token,
        body: { pendingId: resp.json.pendingId, classResolvedPatterns: {} },
      });
      logEvent({
        event: 'save',
        targetTokens: target,
        actualTokens: body.actualTokens,
        rep,
        status: save.status,
        latencyMs: save.latencyMs,
        runId: save.json?.runId,
      });
      if (save.status === 201 && save.json?.runId) runsOk += 1;
      else { runsErr += 1; console.warn(`[reg] ${target}t r${rep}: save ${save.status}`); }
      if ((i + 1) % 5 === 0) console.log(`[reg] ${i + 1}/${sequence.length} (ok=${runsOk} err=${runsErr})`);
    }
  } finally {
    stopHeartbeat();
    const dc = await http('POST', '/auth/disconnect', { token });
    logEvent({ event: 'disconnect', status: dc.status });
  }
  logEvent({ event: 'reg_end', runsOk, runsErr });
  console.log(`[reg] done. ok=${runsOk} err=${runsErr} log=${logPath}`);
}

main().catch((err) => {
  console.error('[reg] fatal:', err && err.message);
  process.exit(1);
});
