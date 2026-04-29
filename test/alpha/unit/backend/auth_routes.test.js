// Auth route unit tests. Uses the server spawned in health.test.js? No — node:test
// runs each file in its own context. To keep this file self-contained, we spawn
// the server here too on a unique port.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const BACKEND_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'Codebase', 'Backend');
const SERVER_ENTRY = path.join(BACKEND_DIR, 'server.js');
const PORT = 4000 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;

const SLA_LOGIN_MS = 250;

function request(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const start = process.hrtime.bigint();
    const req = http.request({
      method,
      host: '127.0.0.1',
      port: PORT,
      path: p,
      headers: data
        ? { 'Content-Type': 'application/json', 'Content-Length': data.length }
        : {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          ms,
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
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
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const r = await request('GET', '/health');
      if (r.status === 200) return;
    } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

test.after(() => { if (child && !child.killed) child.kill(); });

test('GET /auth/test-accounts returns seeded accounts', async () => {
  const r = await request('GET', '/auth/test-accounts');
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.ok(Array.isArray(body.accounts));
});

test(`POST /auth/login (seed) under ${SLA_LOGIN_MS} ms`, async () => {
  const accs = JSON.parse((await request('GET', '/auth/test-accounts')).body);
  const username = (accs.accounts[0] && (accs.accounts[0].username || accs.accounts[0])) || 'Devcon1';
  const password = accs.password || 'devcon';

  // Warmup (bcrypt JIT, sqlite cache).
  await request('POST', '/auth/login', { username, password });
  const r = await request('POST', '/auth/login', { username, password });

  assert.equal(r.status, 200, `login failed: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.equal(typeof body.token, 'string');
  assert.ok(body.token.length > 20);
  assert.ok(
    r.ms <= SLA_LOGIN_MS,
    `login latency ${r.ms.toFixed(1)} ms exceeded ${SLA_LOGIN_MS} ms`,
  );
});

test('POST /auth/login with bad credentials returns 401', async () => {
  const r = await request('POST', '/auth/login', {
    username: 'definitely_not_a_user',
    password: 'wrong',
  });
  assert.ok(r.status === 401 || r.status === 400, `expected 401/400, got ${r.status}`);
});
