import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import type { Database } from 'better-sqlite3';
import { vi } from 'vitest';

vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

describe('learning progress bloom mastery persistence', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-learning-'));
  const dbPath = path.join(tmpRoot, 'learning.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let userId = 0;

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-learning-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');

    initDb();
    const userInsert = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    );
    const userInfo = userInsert.run('learner', 'learner@example.com', 'hash', 'user');
    userId = Number(userInfo.lastInsertRowid);

    const app = express();
    app.use(express.json());
    app.use('/api/learning', learningRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        if (!address || typeof address === 'string') {
          throw new Error('failed to bind test server');
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      const runningServer = server;
      await new Promise<void>((resolve) => runningServer.close(() => resolve()));
    }
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('persists bloom mastery by module and clamps values to 0..6', async () => {
    const token = jwt.sign(
      { id: userId, username: 'learner', email: 'learner@example.com', role: 'user' },
      process.env.JWT_SECRET as string,
    );

    const payload = {
      completedModuleIds: ['module-a'],
      lastUnlockedModuleId: 'module-b',
      triesByModule: { 'module-a': 3 },
      theoryPassedModuleIds: ['module-a'],
      bloomMasteryByModule: {
        'module-a': -2,
        'module-b': 4.6,
        'module-c': 99,
        'module-d': 'bad',
      },
    };

    const putRes = await fetch(`${baseUrl}/api/learning/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toMatchObject({
      ok: true,
      completedModuleIds: ['module-a'],
      lastUnlockedModuleId: 'module-b',
      theoryPassedModuleIds: ['module-a'],
      bloomMasteryByModule: {
        'module-a': 0,
        'module-b': 5,
        'module-c': 6,
        'module-d': 0,
      },
    });

    const getRes = await fetch(`${baseUrl}/api/learning/progress`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toMatchObject({
      completedModuleIds: ['module-a'],
      lastUnlockedModuleId: 'module-b',
      theoryPassedModuleIds: ['module-a'],
      bloomMasteryByModule: {
        'module-a': 0,
        'module-b': 5,
        'module-c': 6,
        'module-d': 0,
      },
    });

    const row = db
      .prepare('SELECT bloom_mastery_by_module FROM learning_progress WHERE user_id = ?')
      .get(userId) as { bloom_mastery_by_module: string };

    expect(JSON.parse(row.bloom_mastery_by_module)).toEqual({
      'module-a': 0,
      'module-b': 5,
      'module-c': 6,
      'module-d': 0,
    });

    const columns = db.prepare('PRAGMA table_info(learning_progress)').all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === 'bloom_mastery_by_module')).toBe(true);
  });

  it('persists optional-module skip decisions (idempotent round-trip)', async () => {
    const info = db
      .prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run('skiplearner', 'skip@example.com', 'hash', 'user');
    const skipUserId = Number(info.lastInsertRowid);
    const token = jwt.sign(
      { id: skipUserId, username: 'skiplearner', email: 'skip@example.com', role: 'user' },
      process.env.JWT_SECRET as string,
    );

    const put = (skippedModuleIds: string[]) =>
      fetch(`${baseUrl}/api/learning/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completedModuleIds: [], lastUnlockedModuleId: null, sessionId: 'sess-1', skippedModuleIds }),
      });

    const first = await put(['module-x', 'module-y']);
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ ok: true, skippedModuleIds: ['module-x', 'module-y'] });

    // Re-sending the same skip set is idempotent — same row, no duplication.
    await put(['module-x', 'module-y']);
    const getRes = await fetch(`${baseUrl}/api/learning/progress`, { headers: { Authorization: `Bearer ${token}` } });
    await expect(getRes.json()).resolves.toMatchObject({ skippedModuleIds: ['module-x', 'module-y'] });

    const rows = db.prepare('SELECT skipped_module_ids FROM learning_progress WHERE user_id = ?').all(skipUserId) as Array<{ skipped_module_ids: string }>;
    expect(rows.length).toBe(1);
    expect(JSON.parse(rows[0].skipped_module_ids)).toEqual(['module-x', 'module-y']);
  });
});
