// Backend unit test — health endpoints. Uses node:test (>=18). No extra deps.
// Quantitative focus: contract shape + per-call latency budget.
//
// Spawns the actual server.js as a child process so this is truly a unit-of-
// integration test of the route layer, not a mocked stub. Port is randomized
// to avoid colliding with a running dev server.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const BACKEND_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'Codebase', 'Backend');
const SERVER_ENTRY = path.join(BACKEND_DIR, 'server.js');

const PORT = 3000 + Math.floor(Math.random() * 1000) + 100;
const BASE = `http://127.0.0.1:${PORT}`;

const SLA = {
  health: 50,        // RAIL tap budget (local)
  apiHealth: 80,
};

function get(pathname) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.get(`${BASE}${pathname}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const ns = Number(process.hrtime.bigint() - start);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          ms: ns / 1e6,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

async function waitReady(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await get('/health');
      if (r.status === 200) return;
    } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not become ready in time');
}

let child;

test.before(async () => {
  child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  await waitReady();
});

test.after(() => {
  if (child && !child.killed) child.kill();
});

test('GET /health returns 200 + JSON status field', async () => {
  const r = await get('/health');
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(typeof body.status, 'string');
});

test(`GET /health under ${SLA.health} ms (RAIL tap budget, local)`, async () => {
  // Warmup once, measure once. For p95 use stress harness.
  await get('/health');
  const r = await get('/health');
  assert.ok(
    r.ms <= SLA.health,
    `latency ${r.ms.toFixed(1)} ms exceeded ${SLA.health} ms`,
  );
});

test('GET /api/health exposes microservice descriptor', async () => {
  const r = await get('/api/health');
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(typeof body.microservice, 'object');
  assert.ok('binaryFound' in body.microservice);
  assert.ok('catalogFound' in body.microservice);
});

test(`GET /api/health under ${SLA.apiHealth} ms (local)`, async () => {
  await get('/api/health');
  const r = await get('/api/health');
  assert.ok(
    r.ms <= SLA.apiHealth,
    `latency ${r.ms.toFixed(1)} ms exceeded ${SLA.apiHealth} ms`,
  );
});

test('GET /api returns endpoints array', async () => {
  const r = await get('/api');
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.ok(Array.isArray(body.endpoints));
  assert.ok(body.endpoints.length > 0);
});

test('GET /nonexistent returns SPA fallback (200, not 404)', async () => {
  const r = await get('/this-route-does-not-exist');
  // server.js sends index.html for non /api routes
  assert.equal(r.status, 200);
});
