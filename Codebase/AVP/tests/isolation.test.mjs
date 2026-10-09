import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolation = await import('../isolation.mjs').catch(() => ({}));

test('demo environment rejects production and arbitrary database destinations', () => {
  assert.equal(typeof isolation.demoEnvironment, 'function', 'isolated demo environment is implemented');
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'avp-isolation-')));
  assert.throws(() => isolation.demoEnvironment(root, '/tmp/real-research.sqlite'), /demo/i);
});

test('runtime environment cannot inherit cloud credentials, endpoints, or database paths', () => {
  assert.equal(typeof isolation.demoEnvironment, 'function');
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'avp-isolation-')));
  const state = path.join(root, 'Codebase/AVP/.local/run-001');
  mkdirSync(state, { recursive: true });
  mkdirSync(path.join(root, 'Codebase/Backend'), { recursive: true });
  mkdirSync(path.join(root, 'Codebase/Frontend'), { recursive: true });
  writeFileSync(path.join(root, 'Codebase/Frontend/.env.local'), 'VITE_API_ORIGIN=https://live.example\n');
  writeFileSync(path.join(root, 'Codebase/Backend/.env'), 'SUPABASE_URL=https://real.example\nNEW_CLOUD_SECRET=private\nDB_PATH=/real/data.sqlite\n');
  const env = isolation.demoEnvironment(root, state, { SUPABASE_SERVICE_KEY: 'secret', AWS_BACKEND_ORIGIN: 'https://live.example', PATH: process.env.PATH });
  assert.equal(env.SUPABASE_URL, '');
  assert.equal(env.SUPABASE_SERVICE_KEY, '');
  assert.equal(env.NEW_CLOUD_SECRET, '');
  assert.equal(env.VITE_API_ORIGIN, '');
  assert.equal(env.DB_PATH, path.join(state, 'demo.sqlite'));
  assert.equal(env.AWS_BACKEND_ORIGIN, 'http://127.0.0.1:4311');
  assert.equal(env.HOST, '127.0.0.1');
  assert.equal(env.SEED_TEST_USERS, '0');
  assert.equal(env.ENABLE_PILOT_LOGIN, 'false');
});

test('demo paths reject symbolic links into other data', () => {
  assert.equal(typeof isolation.demoEnvironment, 'function');
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'avp-isolation-')));
  mkdirSync(path.join(root, 'Codebase/AVP'), { recursive: true });
  symlinkSync(os.tmpdir(), path.join(root, 'Codebase/AVP/.local'));
  assert.throws(() => isolation.demoEnvironment(root, path.join(root, 'Codebase/AVP/.local/run-001')), /symbolic|symlink/i);
});
