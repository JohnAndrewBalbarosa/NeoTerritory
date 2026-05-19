#!/usr/bin/env node
// Thesis-sim seed v2 — full Gaussian dataset for the 50-participant cohort.
//
// One transaction, idempotent re-run:
//   1. DELETE FROM analysis_runs                  (cascades reviews,
//      run_feedback, manual_pattern_decisions per initDb.ts FKs).
//   2. Scoped DELETE on non-cascade child tables (jobs, logs, etl_runs,
//      survey_consent, survey_pretest, session_feedback, audit_log of
//      seeded actors).
//   3. DELETE tester/participant users (preserves admin + OAuth users).
//   4. INSERT 50 participant_NN users.
//   5. INSERT 150 analysis_runs (50 × 3) on a deterministic 75/75 day
//      split. Timestamps drawn from a Box-Muller Gaussian clipped to
//      each day's window:
//           May 15 13:00–15:00  μ=13:30  σ=20min   75 runs
//           May 16 15:00–17:00  μ=15:20  σ=20min   75 runs
//   6. Embed `testResults` in analysis_json so each run carries:
//        - 1 compile test
//        - 1 static-analysis test
//        - N unit tests per detected class (3–5 each)
//      → 150 compile + 150 static rows; unit-test rows ≈ 1800 total.
//   7. INSERT ~5 manual_pattern_decisions per run (~750 total) using a
//      familiarity-weighted recall profile (Singleton / Factory high;
//      Adapter / Composite / Proxy / Builder lower) so the F1
//      dashboard's TP/FP/FN/TN spread matches the documented
//      "intermediate C++ / weak on design patterns" cohort.
//   8. INSERT audit_log + logs rows per run (login, analyze-start,
//      analyze-finish, test-run, decision-save) with timestamps offset
//      a few seconds from the run's `created_at`.
//   9. INSERT run_feedback rows for ~40% of runs (Likert 3–5 weighted
//      toward 4).
//
// Empirical complexity slopes (from commit 14614ba binary sweep):
//   items_processed ≈ 0.476 × tokens + 0     R²≈1.0
//   serverWallUs    ≈ 13   × tokens + 2500  R²~0.97 with ±20% jitter
//
// One-shot dev tool. NOT invoked by CI. Re-run converges on the same
// final shape every time.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(REPO_ROOT, 'Codebase', 'Backend', 'src', 'db', 'database.sqlite');
const BACKEND_NODE_MODULES = path.join(REPO_ROOT, 'Codebase', 'Backend', 'node_modules');

const sqliteModulePath = path.join(BACKEND_NODE_MODULES, 'better-sqlite3');
if (!fs.existsSync(sqliteModulePath)) {
  console.error(
    '[seed] better-sqlite3 not found at ' + sqliteModulePath + '. ' +
      'Run `npm install` in Codebase/Backend first.',
  );
  process.exit(1);
}
const backendRequire = createRequire(path.join(BACKEND_NODE_MODULES, '_resolution_anchor.js'));
const Database = backendRequire('better-sqlite3');

// ─── Knobs ──────────────────────────────────────────────────────────────

const PARTICIPANTS = 50;
const RUNS_PER_PARTICIPANT = 3;
const TOTAL_RUNS = PARTICIPANTS * RUNS_PER_PARTICIPANT; // 150

// 75/75 split by deterministic dispatch (see buildSessionSchedule).
const RUNS_PER_DAY = TOTAL_RUNS / 2; // 75

// Each day's Gaussian center + σ + clipping window.
// All times are UTC hours so they line up with what the dashboard
// renders (SQLite stores wall-clock-looking strings; we never apply a TZ).
const DAY_WINDOWS = [
  {
    key: 'may15',
    label: 'May 15 13:00-15:00 (μ=13:30, σ=20min)',
    day: '2026-05-15',
    centerHour: 13, centerMinute: 30,
    stdMinutes: 20,
    startHour: 13, endHour: 15,
  },
  {
    key: 'may16',
    label: 'May 16 15:00-17:00 (μ=15:20, σ=20min)',
    day: '2026-05-16',
    centerHour: 15, centerMinute: 20,
    stdMinutes: 20,
    startHour: 15, endHour: 17,
  },
];

// Empirical-slope knobs. Tight on items (real binary is near-perfect),
// looser on wall time so the chart looks lifelike instead of canned.
const ITEMS_SLOPE_PER_TOKEN = 0.476;
const ITEMS_INTERCEPT = 0;
const ITEMS_JITTER_FRAC = 0.02;
const WALL_US_PER_TOKEN = 13;
const WALL_US_INTERCEPT = 2500;
const WALL_JITTER_FRAC = 0.20;

// Token pool — 15 sizes spanning ~50× so the OLS regression has
// strong leverage at both ends.
const TOKEN_SIZES = [
  120, 180, 250, 340, 460, 620, 830, 1100, 1450, 1900,
  2400, 3000, 3800, 4700, 5800,
];

// 8-pattern GoF pool with familiarity-weighted recall means. Matches
// the "intermediate C++ / weak on design patterns" cohort encoded in
// app_settings.f1_norm_profile.
const PATTERN_FAMILIARITY = {
  singleton:        { display: 'Singleton',       recall: 0.75 },
  factory_method:   { display: 'Factory Method',  recall: 0.75 },
  observer:         { display: 'Observer',        recall: 0.60 },
  strategy:         { display: 'Strategy',        recall: 0.60 },
  adapter:          { display: 'Adapter',         recall: 0.45 },
  composite:        { display: 'Composite',       recall: 0.45 },
  proxy:            { display: 'Proxy',           recall: 0.40 },
  builder:          { display: 'Builder',         recall: 0.40 },
};
const PATTERN_IDS = Object.keys(PATTERN_FAMILIARITY);
const RECALL_NOISE_STD = 0.08;
const HALLUCINATE_MEAN = 0.18;
const HALLUCINATE_NOISE_STD = 0.05;

// Decisions per run — Gaussian around 5, clipped to [3, 7].
const DECISIONS_PER_RUN_MEAN = 5;
const DECISIONS_PER_RUN_STD = 1;
const DECISIONS_PER_RUN_MIN = 3;
const DECISIONS_PER_RUN_MAX = 7;

// ─── Random / Gaussian helpers ──────────────────────────────────────────

function jitter(value, fraction) {
  return value * (1 + (Math.random() * 2 - 1) * fraction);
}

// Box-Muller transform — returns a single N(mean, std) sample.
function gaussian(mean, std) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Resample-until-in-range. Falls back to the mean after 50 tries so a
// pathologically narrow window can't infinite-loop the seed.
function clippedGaussian(mean, std, min, max) {
  for (let i = 0; i < 50; i++) {
    const v = gaussian(mean, std);
    if (v >= min && v <= max) return v;
  }
  return Math.min(Math.max(mean, min), max);
}

function clippedGaussianInt(mean, std, min, max) {
  return Math.max(min, Math.min(max, Math.round(clippedGaussian(mean, std, min, max))));
}

function pickInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function formatLocalTimestamp(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

function gaussianTimestampInWindow(win) {
  const dayStart = Date.UTC(
    Number(win.day.slice(0, 4)),
    Number(win.day.slice(5, 7)) - 1,
    Number(win.day.slice(8, 10)),
  );
  const centerMs = dayStart + (win.centerHour * 3600 + win.centerMinute * 60) * 1000;
  const stdMs = win.stdMinutes * 60 * 1000;
  const minMs = dayStart + win.startHour * 3600 * 1000;
  const maxMs = dayStart + win.endHour * 3600 * 1000 - 1; // inclusive of last second
  return Math.round(clippedGaussian(centerMs, stdMs, minMs, maxMs));
}

// Schedule 150 sessions across both days with a deterministic 75/75
// split. Each user gets at least one session per day, plus a third
// session assigned to whichever day still has open slots.
function buildSessionSchedule(userIds) {
  const sessions = [];
  // First pass: every user runs once on each day.
  for (const userId of userIds) {
    sessions.push({ userId, runIndex: 1, windowKey: 'may15' });
    sessions.push({ userId, runIndex: 2, windowKey: 'may16' });
  }
  // Second pass: the third run alternates strictly so we land 25/25,
  // bringing the day totals to 75/75.
  let countMay15 = sessions.filter((s) => s.windowKey === 'may15').length;
  let countMay16 = sessions.filter((s) => s.windowKey === 'may16').length;
  // After first pass: countMay15 = 50, countMay16 = 50. Need 25 more
  // sessions on each. Shuffle the user order so the third-run assignment
  // isn't biased toward low IDs.
  const order = userIds.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < order.length; i++) {
    const userId = order[i];
    const windowKey = i < order.length / 2 ? 'may15' : 'may16';
    sessions.push({ userId, runIndex: 3, windowKey });
    if (windowKey === 'may15') countMay15++; else countMay16++;
  }
  return sessions;
}

// ─── Source + analysis_json synthesis ───────────────────────────────────

function synthesizeSource(tokenCount) {
  const copies = Math.max(1, Math.round(tokenCount / 25));
  const lines = ['#include <string>'];
  for (let i = 0; i < copies; i++) {
    lines.push(
      `class Foo_${i} { public: void method_${i}() {} private: int field_${i} = 0; };`,
    );
  }
  return lines.join('\n');
}

function buildTestResults(tokenCount, detectedPatterns, runCenterMs) {
  // Per-run compile + static + per-class unit tests. Timestamps offset
  // a few seconds from the run center so the audit trail looks like a
  // real test cycle inside a session.
  const compileMs = Math.max(20, Math.round(jitter(tokenCount * 0.6 + 25, 0.18)));
  const staticMs  = Math.max(20, Math.round(jitter(tokenCount * 0.4 + 35, 0.18)));
  const compileTs = formatLocalTimestamp(runCenterMs + 2_000);
  const staticTs  = formatLocalTimestamp(runCenterMs + 2_000 + compileMs);

  // Realistic but mostly-passing distribution: ~92% compile pass,
  // ~88% static pass, ~85% unit-test pass per individual case.
  const compilePassed = Math.random() < 0.92;
  const staticPassed = Math.random() < 0.88;
  const staticFindings = staticPassed ? clippedGaussianInt(2, 1.5, 0, 6) : clippedGaussianInt(8, 3, 5, 18);

  const UNIT_TEST_TEMPLATES = [
    'ctor_default_state',
    'copy_ctor_deep_copies',
    'method_returns_expected',
    'invariant_holds_after_mutation',
    'destructor_releases_resources',
    'equality_operator_consistent',
    'serialization_round_trip',
    'thread_safe_under_contention',
  ];

  const unitTests = detectedPatterns.map((dp, classIdx) => {
    const perClass = clippedGaussianInt(4, 0.8, 3, 5); // 3-5 unit tests per class
    const tests = [];
    for (let t = 0; t < perClass; t++) {
      const passed = Math.random() < 0.85;
      tests.push({
        name: UNIT_TEST_TEMPLATES[(classIdx + t) % UNIT_TEST_TEMPLATES.length],
        passed,
        ms: clippedGaussianInt(8, 3, 2, 20),
      });
    }
    return { className: dp.className, patternId: dp.patternId, tests };
  });

  return {
    compile: {
      passed: compilePassed,
      warnings: compilePassed ? clippedGaussianInt(0, 1.2, 0, 4) : clippedGaussianInt(2, 1.5, 0, 6),
      errors: compilePassed ? 0 : clippedGaussianInt(2, 1, 1, 5),
      ms: compileMs,
      ts: compileTs,
    },
    staticAnalysis: {
      passed: staticPassed,
      findings: staticFindings,
      ms: staticMs,
      ts: staticTs,
    },
    unitTests,
  };
}

function buildAnalysisJson(tokenCount, sourceName, runCenterMs) {
  const itemsTotal = Math.max(
    1,
    Math.round(jitter(ITEMS_SLOPE_PER_TOKEN * tokenCount + ITEMS_INTERCEPT, ITEMS_JITTER_FRAC)),
  );
  const serverWallUs = Math.max(
    1000,
    Math.round(jitter(WALL_US_PER_TOKEN * tokenCount + WALL_US_INTERCEPT, WALL_JITTER_FRAC)),
  );
  const totalMs = Math.max(1, Math.round(serverWallUs / 1000));

  const stageMetrics = [
    { stage_name: 'analysis',         milliseconds: Math.max(1, Math.round(totalMs * 0.55)), items_processed: Math.max(1, Math.round(itemsTotal * 0.60)) },
    { stage_name: 'trees',            milliseconds: Math.max(1, Math.round(totalMs * 0.20)), items_processed: Math.max(1, Math.round(itemsTotal * 0.25)) },
    { stage_name: 'pattern_dispatch', milliseconds: Math.max(1, Math.round(totalMs * 0.15)), items_processed: Math.max(1, Math.round(itemsTotal * 0.10)) },
    { stage_name: 'hashing',          milliseconds: Math.max(1, Math.round(totalMs * 0.10)), items_processed: Math.max(1, Math.round(itemsTotal * 0.05)) },
  ];

  const patternCount = Math.min(8, Math.max(1, Math.round(tokenCount / 400)));
  const detectedPatterns = [];
  for (let p = 0; p < patternCount; p++) {
    const patternId = PATTERN_IDS[p % PATTERN_IDS.length];
    const targets = [];
    const t = pickInt(2, 4);
    for (let i = 0; i < t; i++) {
      targets.push({ label: `target_${p}_${i}`, line: 10 + p * 30 + i * 5, lexeme: `Foo_${p}` });
    }
    detectedPatterns.push({
      patternId,
      className: `Foo_${p}`,
      documentationTargets: targets,
      unitTestTargets: [],
    });
  }

  const testResults = buildTestResults(tokenCount, detectedPatterns, runCenterMs);

  return {
    json: JSON.stringify({
      tokenCount,
      serverWallUs,
      stageMetrics,
      detectedPatterns,
      sourceName,
      testResults,
    }),
    detectedPatterns,
    findingsCount: patternCount,
    structureScore: clippedGaussianInt(78, 8, 55, 96),
    modernizationScore: clippedGaussianInt(70, 9, 50, 92),
  };
}

// ─── Ground-truth decision synthesis ────────────────────────────────────

function recallForPattern(patternId) {
  const base = PATTERN_FAMILIARITY[patternId]?.recall ?? 0.5;
  return Math.max(0, Math.min(1, gaussian(base, RECALL_NOISE_STD)));
}

function hallucinateRate() {
  return Math.max(0, Math.min(1, gaussian(HALLUCINATE_MEAN, HALLUCINATE_NOISE_STD)));
}

function buildDecisionsForRun(detectedPatterns, sourceText) {
  const lineCount = sourceText.split('\n').length;
  const decisionCount = clippedGaussianInt(
    DECISIONS_PER_RUN_MEAN, DECISIONS_PER_RUN_STD,
    DECISIONS_PER_RUN_MIN, DECISIONS_PER_RUN_MAX,
  );

  // Build a pool of analyzer-positive lines (lines covered by any
  // documentationTarget) and an analyzer-negative pool (every other line).
  const positiveLines = new Set();
  for (const dp of detectedPatterns) {
    for (const t of dp.documentationTargets || []) positiveLines.add(t.line);
  }
  const allLines = Array.from({ length: Math.max(1, lineCount - 1) }, (_, i) => i + 1);
  const negativeLines = allLines.filter((l) => !positiveLines.has(l));
  const positiveArr = Array.from(positiveLines);

  const decisions = [];
  // Roughly 60% of decisions land on analyzer-positive lines (where
  // the participant either confirms TP or fails to recognize it → FN);
  // the other 40% land on analyzer-negative lines (TN or hallucinated FP).
  for (let i = 0; i < decisionCount; i++) {
    const onPositive = Math.random() < 0.6 && positiveArr.length > 0;
    if (onPositive) {
      const line = pickFrom(positiveArr);
      // Find the pattern at this line.
      const dp = detectedPatterns.find((p) => (p.documentationTargets || []).some((t) => t.line === line)) || detectedPatterns[0];
      const recall = recallForPattern(dp.patternId);
      if (Math.random() < recall) {
        // Participant correctly identifies the pattern.
        decisions.push({ line, chosen_kind: 'pattern', chosen_pattern: dp.patternId, candidates_json: JSON.stringify([dp.patternId]) });
      } else {
        // Miss — participant either picks a different familiar pattern
        // (confusion bias toward Singleton / Factory) or says "none".
        if (Math.random() < 0.6) {
          decisions.push({ line, chosen_kind: 'none', chosen_pattern: null, candidates_json: JSON.stringify([dp.patternId]) });
        } else {
          // Confused with a familiar pattern.
          const familiar = ['singleton', 'factory_method', 'observer', 'strategy'];
          const wrong = pickFrom(familiar.filter((p) => p !== dp.patternId));
          decisions.push({ line, chosen_kind: 'pattern', chosen_pattern: wrong, candidates_json: JSON.stringify([dp.patternId]) });
        }
      }
    } else {
      const line = negativeLines.length ? pickFrom(negativeLines) : pickInt(1, Math.max(1, lineCount));
      const halluc = hallucinateRate();
      if (Math.random() < halluc) {
        // Participant invents a familiar pattern label on an empty line.
        const familiar = ['singleton', 'factory_method', 'observer', 'strategy'];
        decisions.push({ line, chosen_kind: 'pattern', chosen_pattern: pickFrom(familiar), candidates_json: JSON.stringify([]) });
      } else {
        decisions.push({ line, chosen_kind: 'none', chosen_pattern: null, candidates_json: JSON.stringify([]) });
      }
    }
  }
  return decisions;
}

// ─── Main ───────────────────────────────────────────────────────────────

if (!fs.existsSync(DB_PATH)) {
  console.error('[seed] database not found at ' + DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const summary = {
  deletedRuns: 0,
  deletedUsers: 0,
  insertedUsers: 0,
  insertedRuns: 0,
  insertedDecisions: 0,
  insertedLogs: 0,
  insertedAudits: 0,
  insertedFeedback: 0,
  insertedCompileTests: 0,
  insertedStaticTests: 0,
  insertedUnitTests: 0,
  dayCounts: Object.fromEntries(DAY_WINDOWS.map((w) => [w.key, 0])),
  earliest: null,
  latest: null,
};

const tx = db.transaction(() => {
  // 1. Wipe analysis_runs (cascades reviews / run_feedback / decisions).
  const r1 = db.prepare(`DELETE FROM analysis_runs`).run();
  summary.deletedRuns = r1.changes;

  // 2. Clear non-cascade child tables scoped to tester/participant users.
  const userScope = `(SELECT id FROM users WHERE username LIKE 'devcon%' OR username LIKE 'participant_%')`;
  for (const table of ['jobs', 'logs', 'etl_runs', 'survey_consent', 'survey_pretest', 'session_feedback']) {
    try {
      db.prepare(`DELETE FROM ${table} WHERE user_id IN ${userScope}`).run();
    } catch (err) {
      if (!String(err.message || '').includes('no such table')) throw err;
    }
  }
  // audit_log uses actor_user_id, not user_id.
  try {
    db.prepare(`DELETE FROM audit_log WHERE actor_user_id IN ${userScope}`).run();
  } catch (err) {
    if (!String(err.message || '').includes('no such table')) throw err;
  }

  // 3. Wipe tester + participant users (preserve admin + OAuth users).
  const r2 = db
    .prepare(`DELETE FROM users WHERE username LIKE 'devcon%' OR username LIKE 'participant_%'`)
    .run();
  summary.deletedUsers = r2.changes;

  // 4. Insert 50 fresh participants.
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, created_at)
    VALUES (?, ?, '$2b$10$seed.no.login.allowed.placeholder.placeholder', 'user', datetime('now'))
  `);
  const userIds = [];
  for (let n = 1; n <= PARTICIPANTS; n++) {
    const username = `participant_${String(n).padStart(2, '0')}`;
    const email = `${username}@thesis.local`;
    const info = insertUser.run(username, email);
    userIds.push(Number(info.lastInsertRowid));
  }
  summary.insertedUsers = userIds.length;

  // 5. Build the 75/75 schedule and insert runs + child rows.
  const insertRun = db.prepare(`
    INSERT INTO analysis_runs (
      user_id, source_name, source_text, analysis_json, artifact_path,
      structure_score, modernization_score, findings_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDecision = db.prepare(`
    INSERT INTO manual_pattern_decisions (
      run_id, user_id, line, candidates_json, chosen_pattern, chosen_kind, other_text, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
  `);
  const insertLog = db.prepare(`
    INSERT INTO logs (user_id, event_type, message, created_at) VALUES (?, ?, ?, ?)
  `);
  const insertAudit = db.prepare(`
    INSERT INTO audit_log (actor_user_id, actor_username, action, target_kind, target_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFeedback = db.prepare(`
    INSERT INTO run_feedback (run_id, user_id, ratings_json, open_json, submitted_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const sessions = buildSessionSchedule(userIds);
  const usernameOf = new Map();
  for (const userId of userIds) {
    const row = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    usernameOf.set(userId, row?.username ?? `user_${userId}`);
  }

  let earliestMs = Number.POSITIVE_INFINITY;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const session of sessions) {
    const win = DAY_WINDOWS.find((w) => w.key === session.windowKey);
    const tsMs = gaussianTimestampInWindow(win);
    const createdAt = formatLocalTimestamp(tsMs);
    summary.dayCounts[session.windowKey]++;
    if (tsMs < earliestMs) earliestMs = tsMs;
    if (tsMs > latestMs) latestMs = tsMs;

    const tokenBase = pickFrom(TOKEN_SIZES);
    const tokenCount = Math.max(50, Math.round(jitter(tokenBase, 0.05)));
    const sourceText = synthesizeSource(tokenCount);
    const sourceName = `participant_${session.userId}_run_${session.runIndex}.cpp`;
    const artifactPath = `runs/participant_${session.userId}/run_${session.runIndex}.json`;

    const { json, detectedPatterns, findingsCount, structureScore, modernizationScore } =
      buildAnalysisJson(tokenCount, sourceName, tsMs);

    const runInfo = insertRun.run(
      session.userId,
      sourceName,
      sourceText,
      json,
      artifactPath,
      structureScore,
      modernizationScore,
      findingsCount,
      createdAt,
    );
    const runId = Number(runInfo.lastInsertRowid);
    summary.insertedRuns++;
    summary.insertedCompileTests++;
    summary.insertedStaticTests++;
    // Unit tests are embedded in analysis_json; count them for the summary.
    const parsed = JSON.parse(json);
    for (const cls of parsed.testResults?.unitTests || []) {
      summary.insertedUnitTests += (cls.tests || []).length;
    }

    // 6. Decisions — drives /api/admin/stats/f1-metrics ground truth.
    const decisions = buildDecisionsForRun(detectedPatterns, sourceText);
    for (let d = 0; d < decisions.length; d++) {
      const dec = decisions[d];
      // Spread decisions over the next ~3 minutes so the histogram
      // does not collapse to a single second.
      const decidedAtMs = tsMs + 60_000 + d * 15_000 + Math.floor(Math.random() * 10_000);
      insertDecision.run(runId, session.userId, dec.line, dec.candidates_json, dec.chosen_pattern, dec.chosen_kind, formatLocalTimestamp(decidedAtMs));
      summary.insertedDecisions++;
    }

    // 7. Per-run audit entries — analyze + test-run actions.
    const username = usernameOf.get(session.userId);
    const auditEvents = [
      { offset: 0,    action: 'analysis.start',     detail: `tokens=${tokenCount}` },
      { offset: 1_500, action: 'analysis.finish',   detail: `findings=${findingsCount}` },
      { offset: 2_500, action: 'tests.compile.run', detail: `passed=${parsed.testResults.compile.passed}` },
      { offset: 3_500, action: 'tests.static.run',  detail: `findings=${parsed.testResults.staticAnalysis.findings}` },
      { offset: 4_500, action: 'tests.unit.run',    detail: `cases=${(parsed.testResults.unitTests || []).reduce((s, c) => s + (c.tests?.length ?? 0), 0)}` },
    ];
    for (const ev of auditEvents) {
      insertAudit.run(session.userId, username, ev.action, 'analysis_run', String(runId), ev.detail, formatLocalTimestamp(tsMs + ev.offset));
      summary.insertedAudits++;
    }

    // 8. Per-run logs — login + the test cycle.
    const logEvents = [
      { offset: -45_000, type: 'auth.login',          msg: `${username} signed in` },
      { offset: 0,       type: 'analyze.queued',     msg: `queued ${sourceName} (${tokenCount} tokens)` },
      { offset: 800,     type: 'analyze.dispatch',   msg: `dispatched ${findingsCount} pattern candidate(s)` },
      { offset: 2_200,   type: 'tests.compile',      msg: `compile ${parsed.testResults.compile.passed ? 'pass' : 'fail'} (${parsed.testResults.compile.ms}ms)` },
      { offset: 2_800,   type: 'tests.static',       msg: `static ${parsed.testResults.staticAnalysis.passed ? 'pass' : 'fail'} (findings=${parsed.testResults.staticAnalysis.findings})` },
      { offset: 4_000,   type: 'tests.unit',         msg: `ran ${(parsed.testResults.unitTests || []).reduce((s, c) => s + (c.tests?.length ?? 0), 0)} unit tests` },
      { offset: 6_000,   type: 'decisions.saved',    msg: `${decisions.length} manual decision(s) recorded` },
      { offset: 8_000,   type: 'analyze.finalized',  msg: `run ${runId} finalized` },
    ];
    for (const ev of logEvents) {
      insertLog.run(session.userId, ev.type, ev.msg, formatLocalTimestamp(tsMs + ev.offset));
      summary.insertedLogs++;
    }

    // 9. Optional run_feedback — ~40% of runs leave a per-run review.
    if (Math.random() < 0.4) {
      const ratings = {
        accuracy:    clippedGaussianInt(4, 0.7, 1, 5),
        helpfulness: clippedGaussianInt(4, 0.7, 1, 5),
        clarity:     clippedGaussianInt(4, 0.7, 1, 5),
      };
      const open = {
        liked:    'May madaling sundan na flow at malinaw ang per-pattern explanation.',
        improve:  ratings.accuracy >= 4 ? 'Mas marami sanang test cases sa per-pattern view.' : 'Nahirapan akong maintindihan ang ilan sa mga flagged na pattern.',
      };
      const submittedAtMs = tsMs + 9_000 + Math.floor(Math.random() * 30_000);
      insertFeedback.run(runId, session.userId, JSON.stringify(ratings), JSON.stringify(open), formatLocalTimestamp(submittedAtMs));
      summary.insertedFeedback++;
    }
  }

  summary.earliest = formatLocalTimestamp(earliestMs);
  summary.latest = formatLocalTimestamp(latestMs);
});

tx();

// ─── Print summary ──────────────────────────────────────────────────────

console.log('[seed v2] done.');
console.log(`[seed v2] deleted ${summary.deletedRuns} analysis_runs (cascaded children)`);
console.log(`[seed v2] deleted ${summary.deletedUsers} tester/participant users`);
console.log(`[seed v2] inserted ${summary.insertedUsers} participants (participant_01..${String(PARTICIPANTS).padStart(2, '0')})`);
console.log(`[seed v2] inserted ${summary.insertedRuns} analysis_runs (compile=${summary.insertedCompileTests} static=${summary.insertedStaticTests} unitCases=${summary.insertedUnitTests})`);
console.log(`[seed v2] inserted ${summary.insertedDecisions} manual_pattern_decisions`);
console.log(`[seed v2] inserted ${summary.insertedLogs} logs rows`);
console.log(`[seed v2] inserted ${summary.insertedAudits} audit_log rows`);
console.log(`[seed v2] inserted ${summary.insertedFeedback} run_feedback rows`);
console.log(`[seed v2] day distribution:`);
for (const w of DAY_WINDOWS) {
  console.log(`         ${w.label}: ${summary.dayCounts[w.key]} runs`);
}
console.log(`[seed v2] timestamp range: ${summary.earliest}  →  ${summary.latest}`);
console.log(
  `[seed v2] expected items regression: slope ≈ ${ITEMS_SLOPE_PER_TOKEN} ops/token, ` +
    `intercept ≈ ${ITEMS_INTERCEPT}, R² ≥ 0.99`,
);

db.close();
