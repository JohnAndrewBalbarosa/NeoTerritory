#!/usr/bin/env node
// Pulls all run_feedback + session_feedback rows out of the AWS DB via SSH,
// recomputes the same per-question + per-section statistics that
// compute-stats.mjs derives from the fixture, and reports any mismatch.
// Run AFTER the soak has finished.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SSH_KEY = process.env.AWS_SSH_KEY || `${process.env.HOME}/.ssh/lightsail_neoterritory`;
const SSH_HOST = process.env.AWS_HOST || '122.248.192.49';
const SSH_USER = process.env.AWS_USER || 'ubuntu';
const DB_PATH  = process.env.AWS_DB_PATH || '/home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite';
const FIXTURE  = process.env.SOAK_FIXTURE || 'tools/thesis-sim/dataset.json';
const STATS_MD = process.env.STATS_MD || 'tools/thesis-sim/stats.md';

function ssh(sql) {
  // Use base64 so quoting + newlines survive the SSH hop unchanged.
  const b64 = Buffer.from(sql).toString('base64');
  const cmd = `ssh -o StrictHostKeyChecking=accept-new -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} ` +
    `"echo ${b64} | base64 -d | sudo sqlite3 -separator '|' ${DB_PATH}"`;
  return execSync(cmd, { encoding: 'utf8' });
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const PER_RUN_KEYS = fixture.perRunQuestions;
const SESSION_KEYS = fixture.sessionLikertQuestions;
const PROFILE_KEYS = fixture.profileQuestions;
const DEVCON_USERS = fixture.users.map((u) => `'${u.username}'`).join(',');

// Pull per-run rows joined to username.
const perRunSql =
  `SELECT u.username, rf.run_id, rf.ratings_json FROM run_feedback rf JOIN users u ON u.id=rf.user_id WHERE u.username IN (${DEVCON_USERS}) ORDER BY rf.id;`;
const sessionSql =
  `SELECT u.username, sf.session_uuid, sf.ratings_json FROM session_feedback sf JOIN users u ON u.id=sf.user_id WHERE u.username IN (${DEVCON_USERS}) ORDER BY sf.id;`;
const consentSql =
  `SELECT COUNT(*) FROM survey_consent sc JOIN users u ON u.id=sc.user_id WHERE u.username IN (${DEVCON_USERS});`;
const analysisSql =
  `SELECT COUNT(*) FROM analysis_runs ar JOIN users u ON u.id=ar.user_id WHERE u.username IN (${DEVCON_USERS});`;

console.log(`[verify] querying ${SSH_HOST}:${DB_PATH}…`);
const perRunRaw = ssh(perRunSql).trim();
const sessionRaw = ssh(sessionSql).trim();
const consentCount = Number(ssh(consentSql).trim());
const analysisCount = Number(ssh(analysisSql).trim());

const perRunRows = perRunRaw ? perRunRaw.split(/\r?\n/).map((line) => {
  const [username, runId, jsonStr] = line.split('|');
  return { username, runId: Number(runId), ratings: JSON.parse(jsonStr) };
}) : [];

const sessionRows = sessionRaw ? sessionRaw.split(/\r?\n/).map((line) => {
  const [username, sessionUuid, jsonStr] = line.split('|');
  return { username, sessionUuid, ratings: JSON.parse(jsonStr) };
}) : [];

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
function freq(arr) {
  const f = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of arr) if (f[v] !== undefined) f[v] += 1;
  return f;
}

function compareToFixture() {
  // Roll up DB observations.
  const perRunByKey = Object.fromEntries(PER_RUN_KEYS.map((k) => [k, []]));
  for (const r of perRunRows) for (const k of PER_RUN_KEYS) if (r.ratings[k] != null) perRunByKey[k].push(r.ratings[k]);
  const sessionByKey = Object.fromEntries(SESSION_KEYS.map((k) => [k, []]));
  const profileByKey = Object.fromEntries(PROFILE_KEYS.map((k) => [k, []]));
  for (const r of sessionRows) {
    for (const k of SESSION_KEYS) if (r.ratings[k] != null) sessionByKey[k].push(r.ratings[k]);
    for (const k of PROFILE_KEYS) if (r.ratings[k] != null) profileByKey[k].push(r.ratings[k]);
  }

  // Roll up fixture observations.
  const fxPerRunByKey = Object.fromEntries(PER_RUN_KEYS.map((k) => [k, []]));
  const fxSessionByKey = Object.fromEntries(SESSION_KEYS.map((k) => [k, []]));
  const fxProfileByKey = Object.fromEntries(PROFILE_KEYS.map((k) => [k, []]));
  for (const u of fixture.users) {
    for (const k of PROFILE_KEYS) fxProfileByKey[k].push(u.profile[k]);
    for (const run of u.runs) for (const k of PER_RUN_KEYS) fxPerRunByKey[k].push(run.ratings[k]);
    for (const k of SESSION_KEYS) fxSessionByKey[k].push(u.session_ratings[k]);
  }

  let mismatchCount = 0;
  const lines = [];
  lines.push('# AWS DB vs Fixture — Stats Parity Check');
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString()} — pulled rows live from ${SSH_HOST}._`);
  lines.push('');
  lines.push(`- DB \`run_feedback\` rows: **${perRunRows.length}** (expected ${PER_RUN_KEYS.length === 0 ? 0 : fixture.users.length * fixture.users[0].runs.length})`);
  lines.push(`- DB \`session_feedback\` rows: **${sessionRows.length}** (expected ${fixture.users.length})`);
  lines.push(`- DB \`survey_consent\` rows: **${consentCount}** (expected ${fixture.users.length})`);
  lines.push(`- DB \`analysis_runs\` rows: **${analysisCount}** (expected ${fixture.users.length * fixture.users[0].runs.length})`);
  lines.push('');

  function diffOne(key, dbArr, fxArr, scope) {
    const dbMean = mean(dbArr);
    const fxMean = mean(fxArr);
    const ok = Math.abs(dbMean - fxMean) < 0.005 && dbArr.length === fxArr.length;
    if (!ok) mismatchCount += 1;
    return `| ${scope} | **${key}** | ${dbArr.length} | ${dbMean.toFixed(2)} | ${stdev(dbArr).toFixed(2)} | ${fxArr.length} | ${fxMean.toFixed(2)} | ${ok ? '✓' : '✗ MISMATCH'} |`;
  }

  lines.push('## Per-question parity');
  lines.push('');
  lines.push('| Scope | Item | DB N | DB Mean | DB SD | Fixture N | Fixture Mean | Match |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---|');
  for (const k of PER_RUN_KEYS)  lines.push(diffOne(k, perRunByKey[k],  fxPerRunByKey[k],  'per-run'));
  for (const k of SESSION_KEYS)  lines.push(diffOne(k, sessionByKey[k], fxSessionByKey[k], 'sign-out'));
  for (const k of PROFILE_KEYS)  lines.push(diffOne(k, profileByKey[k], fxProfileByKey[k], 'profile'));
  lines.push('');

  lines.push(`**Total mismatches: ${mismatchCount}**`);
  lines.push('');

  // Final per-section weighted means recomputed from DB
  const SECTION_KEYS = {
    'Functional Suitability':       ['B.1', 'B.2', 'B.3', 'B.4', 'B.5', 'B.6', 'B.7', 'B.8'],
    'Usability':                    ['C.9', 'C.10', 'C.11', 'C.12', 'C.13'],
    'Performance Efficiency':       ['D.14', 'D.15'],
    'Reliability':                  ['E.16', 'E.17'],
    'Security and Data Protection': ['F.18', 'F.19']
  };
  lines.push('## Per-section weighted means recomputed from DB');
  lines.push('');
  lines.push('| Section | Total obs | Sum | Weighted mean |');
  lines.push('|---|---:|---:|---:|');
  for (const [section, keys] of Object.entries(SECTION_KEYS)) {
    let sum = 0, cnt = 0;
    for (const k of keys) {
      const arr = PER_RUN_KEYS.includes(k) ? perRunByKey[k] : sessionByKey[k];
      for (const v of arr) { sum += v; cnt += 1; }
    }
    lines.push(`| **${section}** | ${cnt} | ${sum} | ${cnt ? (sum / cnt).toFixed(2) : '—'} |`);
  }
  lines.push('');

  const out = 'tools/thesis-sim/verify-receipt.md';
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`Wrote ${out} — mismatches: ${mismatchCount}`);
  return mismatchCount;
}

const exitCode = compareToFixture() === 0 ? 0 : 1;
process.exit(exitCode);
