#!/usr/bin/env node
// Backfill gdb.* event counts: fire N rounds of analyze + save + run-tests
// against AWS to pump up the unit-test sample volume on /stats/test-runs.
// No surveys, no manual-review — only the test-pod path.

import { synthesizeCppFiles } from '../../scripts/lib/cppSynth.mjs';

const BASE = (process.env.SOAK_BASE_URL || 'http://122.248.192.49').replace(/\/$/, '');
const N = Number(process.env.BACKFILL_N || 80);
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY || 3);
const USERNAMES = ['devcon1','devcon2','devcon3','devcon4','devcon5'];

async function http(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}${url}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, latencyMs: Date.now() - t0 };
  } catch (err) { return { status: 0, json: null, text: String(err), latencyMs: Date.now() - t0 }; }
}

const tokens = new Map();
async function tokenFor(u) {
  if (tokens.has(u)) return tokens.get(u);
  let r = await http('POST', '/auth/login', { body: { username: u, password: 'devcon' } });
  if (r.status !== 200) r = await http('POST', '/auth/claim', { body: { username: u } });
  if (r.status === 200 && r.json?.token) { tokens.set(u, r.json.token); return r.json.token; }
  return null;
}

let done = 0, ok = 0, fail = 0;
async function oneRound(idx) {
  const u = USERNAMES[idx % USERNAMES.length];
  const tok = await tokenFor(u);
  if (!tok) { fail++; return; }
  const payload = synthesizeCppFiles(`backfill-${idx}|2026-05-17`);
  const body = payload.files.length === 1
    ? { filename: payload.files[0].name, code: payload.files[0].code }
    : { files: payload.files };
  const a = await http('POST', '/api/analyze', { token: tok, body });
  if (a.status !== 200 || !a.json?.pendingId) { fail++; return; }
  const s = await http('POST', '/api/runs/save', { token: tok, body: { pendingId: a.json.pendingId } });
  if (s.status !== 201 || !s.json?.runId) { fail++; return; }
  const t = await http('POST', `/api/analysis/${s.json.runId}/run-tests`, { token: tok, body: { stdin: '' } });
  if (t.status === 200) ok++;
  else fail++;
}

async function pool() {
  let i = 0;
  async function worker() {
    while (i < N) {
      const idx = i++;
      await oneRound(idx);
      done++;
      if (done % 10 === 0) console.log(`[backfill] ${done}/${N} ok=${ok} fail=${fail}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

console.log(`[backfill] BASE=${BASE} N=${N} concurrency=${CONCURRENCY}`);
await pool();
console.log(`[backfill] done. ok=${ok}/${N}`);
