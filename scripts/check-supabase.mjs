#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// check-supabase.mjs — pre-flight connectivity + schema probe.
// Reads scripts/.env.deploy, then:
//   1. GETs /rest/v1/<table>?select=id&limit=1 to confirm the table exists
//      and the service-role key has read access.
//   2. POSTs a synthetic row using the SAME shape supabaseLogger.ts ships,
//      then DELETEs it so nothing real is left behind.
//
// Exits 0 on full pass, 1 on any failure. Run BEFORE deploying:
//   node scripts/check-supabase.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '.env.deploy');

let envText;
try { envText = readFileSync(envPath, 'utf8'); }
catch { console.error(`[check] missing ${envPath}`); process.exit(1); }

const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const idx = line.indexOf('=');
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const URL  = (env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY  = env.SUPABASE_SERVICE_KEY || '';
const TLOG = env.SUPABASE_LOGS_TABLE || 'admin_logs';
const TAUD = env.SUPABASE_AUDIT_TABLE || 'admin_audit_log';

if (!URL || !KEY) { console.error('[check] SUPABASE_URL or SUPABASE_SERVICE_KEY not set'); process.exit(1); }
if (KEY.startsWith('sb_publishable_') || KEY.startsWith('sb_anon_')) {
  console.error('[check] SUPABASE_SERVICE_KEY is a publishable/anon key — RLS will block writes');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

let failures = 0;

async function probe(table, bodyMaker) {
  console.log(`\n── ${table} ──`);
  // 1. read
  const sel = await fetch(`${URL}/rest/v1/${table}?select=id&limit=1`, { headers });
  if (!sel.ok) {
    console.error(`  ✗ SELECT failed: ${sel.status} ${await sel.text()}`);
    failures++; return;
  }
  console.log(`  ✓ SELECT ok (table exists, key has read)`);

  // 2. write
  const body = bodyMaker();
  const ins = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!ins.ok) {
    console.error(`  ✗ INSERT failed: ${ins.status} ${await ins.text()}`);
    failures++; return;
  }
  const inserted = await ins.json();
  const id = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  console.log(`  ✓ INSERT ok (id=${id})`);

  // 3. cleanup
  if (id != null) {
    const del = await fetch(`${URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers });
    if (!del.ok) console.warn(`  ! DELETE cleanup failed (${del.status}) — row id=${id} left behind`);
    else console.log(`  ✓ DELETE cleanup ok`);
  }
}

// Probe IDs are large random ints to avoid colliding with real rows
// (the mirror tables use bigint primary keys, not bigserial — id is set
// by the backend, matching the SQLite rowid).
const probeId = () => Math.floor(9_000_000_000 + Math.random() * 1_000_000_000);
const now = () => new Date().toISOString();

console.log(`Probing ${URL}`);

await probe(TLOG, () => ({
  user_id: null, event_type: 'connectivity_probe',
  message: 'pre-flight check', created_at: now(),
}));
await probe(TAUD, () => ({
  actor_user_id: null, actor_username: 'connectivity-probe',
  action: 'probe', target_kind: 'pre-flight', target_id: null,
  detail: 'pre-flight check', created_at: now(),
}));
await probe('users', () => ({
  id: probeId(), username: 'probe', email: 'probe@example.invalid',
  role: 'user', created_at: now(),
}));
await probe('jobs', () => ({
  id: probeId(), user_id: null, input_file_path: '/tmp/probe',
  output_file_path: '/tmp/probe.out', job_status: 'probe', created_at: now(),
}));
await probe('analysis_runs', () => ({
  id: probeId(), user_id: null,
  source_name: 'probe.cpp', source_text: '// probe',
  analysis: { findings: [], stageMetrics: [{ stage_name: 'probe', items_processed: 0, milliseconds: 0 }] },
  artifact_path: '/tmp/probe-artifact',
  structure_score: 0, modernization_score: 0, findings_count: 0,
  created_at: now(),
}));
await probe('reviews', () => ({
  id: probeId(), user_id: 0, scope: 'probe', analysis_run_id: null,
  answers: { probe: true }, schema_version: 'probe', created_at: now(),
}));
await probe('manual_pattern_decisions', () => ({
  id: probeId(), run_id: 0, user_id: 0, line: 1,
  candidates: [], chosen_pattern: null, chosen_kind: 'probe',
  other_text: null, decided_at: now(),
}));
await probe('survey_consent', () => ({
  id: probeId(), user_id: 0, accepted_at: now(), version: 'probe',
}));
await probe('survey_pretest', () => ({
  id: probeId(), user_id: 0, answers: { probe: true }, submitted_at: now(),
}));
await probe('run_feedback', () => ({
  id: probeId(), run_id: 'probe', user_id: 0,
  ratings: { probe: 5 }, open: { probe: 'pre-flight' }, submitted_at: now(),
}));
await probe('session_feedback', () => ({
  id: probeId(), user_id: 0, session_uuid: 'probe',
  ratings: { probe: 5 }, open: { probe: 'pre-flight' }, submitted_at: now(),
}));

if (failures > 0) {
  console.error(`\n✗ ${failures} probe(s) failed — fix before deploying.`);
  process.exit(1);
}
console.log('\n✓ Supabase connectivity OK — admin/audit log mirror will work.');
