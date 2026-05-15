// True-positive sweep against live AWS /api/analyze.
// Auths as devcon1, claims the seat, posts every dataset sample,
// classifies pass/wrong/none using the same normalize rule the
// frontend's PatternsLearnPage uses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE || 'http://122.248.192.49';
const USER = process.env.PROBE_USER || 'devcon1';
const PASS = process.env.PROBE_PASS || 'devcon';

// Mirror Codebase/Frontend/src/components/marketing/patterns/PatternsLearnPage.tsx:91-94
function normalize(s) {
  if (!s) return '';
  return String(s).toLowerCase().trim().replace(/^[a-z]+\./, '').replace(/[^a-z0-9]/g, '');
}

// Mirror NON_DETECTED_QUIZZES + ALIAS in learningModules.ts attachPractical().
const FOLDER_TO_EXPECTED_DETECTION = {
  singleton: 'singleton',
  factory: 'factory',
  builder: 'builder',
  method_chaining: 'methodchaining',
  adapter: 'adapter',
  decorator: 'decorator',
  proxy: 'proxy',
  strategy_interface: 'strategyinterface',
  pimpl: 'pimpl',
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function main() {
  console.log(`[probe] base=${BASE} user=${USER}`);

  // 1. Claim seat
  const claim = await postJson(`${BASE}/auth/claim`, { username: USER });
  console.log(`[claim] status=${claim.status}`);

  // 2. Login → JWT
  const login = await postJson(`${BASE}/auth/login`, { username: USER, password: PASS });
  if (login.status !== 200 || !login.json?.token) {
    console.error(`[login] FAILED status=${login.status} body=${login.text.slice(0, 200)}`);
    process.exit(1);
  }
  const jwt = login.json.token;
  console.log(`[login] ok jwt=...${jwt.slice(-8)}`);

  // 3. Walk dataset
  const datasetsRoot = path.join(here, 'datasets');
  const folders = fs.readdirSync(datasetsRoot).filter((d) => fs.statSync(path.join(datasetsRoot, d)).isDirectory());

  const results = [];
  for (const folder of folders) {
    const expected = FOLDER_TO_EXPECTED_DETECTION[folder];
    if (!expected) {
      console.log(`[skip] ${folder} — no expected mapping`);
      continue;
    }
    const dir = path.join(datasetsRoot, folder);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cpp')).sort();
    for (const f of files) {
      const code = fs.readFileSync(path.join(dir, f), 'utf8');
      const r = await postJson(`${BASE}/api/analyze`, { code, filename: f }, { Authorization: `Bearer ${jwt}` });
      const detected = (r.json?.detectedPatterns || []).map((p) => ({
        id: p.patternId,
        name: p.patternName || '',
      }));
      const idsNorm = detected.map((d) => normalize(d.id));
      const namesNorm = detected.map((d) => normalize(d.name));
      const want = expected;
      const hit = idsNorm.includes(want) || namesNorm.includes(want);
      let verdict;
      if (hit) verdict = 'PASS';
      else if (detected.length > 0) verdict = 'WRONG';
      else verdict = 'NONE';
      const row = {
        folder, file: f, expected: want,
        verdict,
        detected: detected.map((d) => d.id),
        status: r.status,
      };
      results.push(row);
      const flag = verdict === 'PASS' ? '✓' : verdict === 'WRONG' ? '✗' : '·';
      console.log(`  ${flag} ${folder}/${f.padEnd(38)} → ${verdict.padEnd(6)} (${detected.map(d=>d.id).join(',') || '-'})`);
      await sleep(500); // rate-limit
    }
  }

  // 4. Disconnect
  await postJson(`${BASE}/auth/disconnect`, {}, { Authorization: `Bearer ${jwt}` });

  // 5. Summary
  const summary = {};
  for (const r of results) {
    summary[r.folder] ??= { pass: 0, wrong: 0, none: 0, total: 0 };
    summary[r.folder].total++;
    summary[r.folder][r.verdict.toLowerCase()]++;
  }
  console.log('\n=== summary ===');
  for (const [folder, s] of Object.entries(summary)) {
    console.log(`  ${folder.padEnd(20)} ${s.pass}/${s.total} pass (${s.wrong} wrong, ${s.none} none)`);
  }
  fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify({ summary, results }, null, 2));
  console.log(`\nresults written to ${path.join(here, 'results.json')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
