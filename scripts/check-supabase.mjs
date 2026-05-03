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

console.log(`Probing ${URL}`);
await probe(TLOG,  () => ({
  user_id: null,
  event_type: 'connectivity_probe',
  message: 'pre-flight check from check-supabase.mjs',
  created_at: new Date().toISOString(),
}));
await probe(TAUD, () => ({
  actor_user_id: null,
  actor_username: 'connectivity-probe',
  action: 'probe',
  target_kind: 'pre-flight',
  target_id: null,
  detail: 'pre-flight check from check-supabase.mjs',
  created_at: new Date().toISOString(),
}));

if (failures > 0) {
  console.error(`\n✗ ${failures} probe(s) failed — fix before deploying.`);
  process.exit(1);
}
console.log('\n✓ Supabase connectivity OK — admin/audit log mirror will work.');
