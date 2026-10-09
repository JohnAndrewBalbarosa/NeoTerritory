import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../config.mjs';

test('calling worker directly cannot open an unowned database before validation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avp-unowned-'));
  const dbPath = path.join(dir, 'research.sqlite');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'Codebase/Backend/node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'Codebase/AVP/worker.ts'), 'reset'], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, DB_PATH: dbPath }, encoding: 'utf8', timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(dbPath), false, 'A rejected worker must not even open an unowned database');
});
