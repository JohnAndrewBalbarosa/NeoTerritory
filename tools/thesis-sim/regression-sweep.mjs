#!/usr/bin/env node
// Lightweight /api/analyze sweep — drives ~80 single-call analyses across
// a deterministic token-size ladder so the regression endpoint sees a
// real range of N values. NO test-pods, NO survey-roundtrip, NO manual-
// review loop — minimum load on the Lightsail t3.small so we can run
// this without disrupting normal use.
//
// Each call also saves the run via /api/runs/save so it lands in
// analysis_runs (which is what /admin/stats/complexity-data reads).

import fs from 'node:fs';
import { synthesizeCppFiles } from '../../scripts/lib/cppSynth.mjs';

const BASE_URL = (process.env.SOAK_BASE_URL || 'http://122.248.192.49').replace(/\/$/, '');
const N_TARGETS = Number(process.env.SWEEP_N || 80);
const MIN_TOKENS = Number(process.env.SWEEP_MIN_TOKENS || 80);
const MAX_TOKENS = Number(process.env.SWEEP_MAX_TOKENS || 4800);
const USERNAME = process.env.SWEEP_USER || 'devcon1';

async function http(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  const resp = await fetch(`${BASE_URL}${url}`, {
    method, headers, body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await resp.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: resp.status, json, text, latencyMs: Date.now() - t0 };
}

// 1. login
console.log(`[sweep] login ${USERNAME}`);
let auth = await http('POST', '/auth/login', { body: { username: USERNAME, password: 'devcon' } });
if (auth.status !== 200) {
  // Fall back to claim if password auth doesn't accept devcon seats
  auth = await http('POST', '/auth/claim', { body: { username: USERNAME } });
}
if (auth.status !== 200 || !auth.json?.token) {
  console.error('Auth failed:', auth.status, auth.text);
  process.exit(1);
}
const token = auth.json.token;

// 2. consent (idempotent)
await http('POST', '/api/survey/consent', { token, body: { version: '2026-05-15' } });

// 3. sweep — generate N submissions with token counts spread across the band
const targets = [];
for (let i = 0; i < N_TARGETS; i++) {
  const frac = i / (N_TARGETS - 1);
  // Quadratic spacing biases the lower end (more measurements where
  // resolution matters); upper end still reaches MAX_TOKENS.
  const target = Math.round(MIN_TOKENS + (MAX_TOKENS - MIN_TOKENS) * (frac * 0.7 + 0.3 * frac * frac));
  targets.push(target);
}

const log = [];
let ok = 0;
for (let i = 0; i < targets.length; i++) {
  const target = targets[i];
  // Generate progressively larger code by stacking synthesizer output.
  // The synth's natural variance + the cap-to-3-files limit means we
  // need a separate scaling strategy at the upper end.
  let payload = synthesizeCppFiles(`sweep-${i}-${target}|seed-2026-05-16`);
  // Estimate token count and scale up by repeating classes if needed.
  let estTokens = payload.files.reduce((s, f) => s + Math.floor(f.code.length / 4), 0);
  let attempts = 0;
  while (estTokens < target * 0.85 && attempts < 5) {
    // Concatenate another synthesizer pass into the first file with
    // suffixed identifiers to avoid duplicate-symbol clashes.
    const extra = synthesizeCppFiles(`sweep-${i}-${target}-extra${attempts}|extra-${attempts}`);
    const extracted = extra.files[0].code
      .replace(/^\/\/.*$/gm, '')                                  // strip top comment
      .replace(/^#include[^\n]*\n/gm, '')                          // strip includes
      .replace(/^namespace [a-z_]+ \{|^\} \/\/ namespace [a-z_]+/gm, '') // strip ns
      .replace(/\b([A-Z][A-Za-z0-9]*?)([A-Z][a-z]+)\b/g, `$1$2_e${attempts}`); // rename
    payload.files[0].code += '\n' + extracted;
    estTokens = payload.files.reduce((s, f) => s + Math.floor(f.code.length / 4), 0);
    attempts++;
  }

  const analyzeBody = payload.files.length === 1
    ? { filename: payload.files[0].name, code: payload.files[0].code }
    : { files: payload.files };
  const r = await http('POST', '/api/analyze', { token, body: analyzeBody });
  if (r.status !== 200 || !r.json?.pendingId) {
    console.warn(`[sweep] ${i + 1}/${N_TARGETS} target=${target} analyze status=${r.status}`);
    log.push({ target, estTokens, status: r.status, ok: false });
    continue;
  }
  const save = await http('POST', '/api/runs/save', { token, body: { pendingId: r.json.pendingId } });
  const realTokens = r.json.tokenCount || estTokens;
  if (save.status === 201) {
    ok++;
    log.push({ target, estTokens, realTokens, runId: save.json?.runId, status: 'ok', wallUs: r.json.serverWallUs });
    if ((i + 1) % 10 === 0) console.log(`[sweep] ${i + 1}/${N_TARGETS} (ok=${ok}) tokens=${realTokens} wallUs=${r.json.serverWallUs}`);
  } else {
    log.push({ target, estTokens, status: save.status, ok: false });
  }
}

// 4. release seat
await http('POST', '/auth/disconnect', { token });

const out = `test-artifacts/regression-sweep-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(out, JSON.stringify({ ok, total: N_TARGETS, log }, null, 2));
console.log(`[sweep] done. ok=${ok}/${N_TARGETS} log=${out}`);
