import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import type { Database } from 'better-sqlite3';

vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

// Regression for "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
// constraint": a learner's progress must save even when learning_progress was
// created with the original PRIMARY KEY(user_id), before session_id joined the
// key. The conceptual-assessment perfect-score path persists progress here.
describe('learner progress persistence on a legacy schema', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-learning-progress-'));
  const dbPath = path.join(tmpRoot, 'learning.sqlite');
  let db: Database;
  let server: http.Server | undefined;
  let baseUrl = '';
  let token = '';

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-learning-progress-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    const user = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    ).run('legacy-progress-learner', 'legacy-progress@example.com', 'hash', 'user');
    const userId = Number(user.lastInsertRowid);
    token = jwt.sign(
      { id: userId, username: 'legacy-progress-learner', email: 'legacy-progress@example.com', role: 'user' },
      process.env.JWT_SECRET,
    );

    // Rebuild learning_progress with the legacy single-column primary key while
    // keeping the session_id column (the state of installs that predate the
    // composite key migration).
    db.prepare('DROP TABLE learning_progress').run();
    db.prepare(`
      CREATE TABLE learning_progress (
        user_id INTEGER NOT NULL PRIMARY KEY,
        session_id TEXT,
        completed_module_ids TEXT NOT NULL DEFAULT '[]',
        last_unlocked_module_id TEXT,
        tries_by_module TEXT NOT NULL DEFAULT '{}',
        theory_passed_module_ids TEXT NOT NULL DEFAULT '[]',
        bloom_mastery_by_module TEXT NOT NULL DEFAULT '{}',
        skipped_module_ids TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    const app = express();
    app.use(express.json());
    app.use('/api/learning', learningRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        if (!address || typeof address === 'string') throw new Error('failed to bind test server');
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

  it('saves and updates progress without an ON CONFLICT constraint error', async () => {
    const save = (completedModuleIds: string[], theoryPassedModuleIds: string[]) => fetch(
      `${baseUrl}/api/learning/progress`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: 'session-1',
          completedModuleIds,
          lastUnlockedModuleId: completedModuleIds[completedModuleIds.length - 1] ?? null,
          theoryPassedModuleIds,
        }),
      },
    );

    const first = await save(['module-a'], ['module-a']);
    expect(first.status).toBe(200);

    const second = await save(['module-a', 'module-b'], ['module-a', 'module-b']);
    expect(second.status).toBe(200);

    const row = db.prepare(`
      SELECT completed_module_ids AS completed, theory_passed_module_ids AS theory
      FROM learning_progress
      WHERE user_id = (SELECT id FROM users WHERE email = 'legacy-progress@example.com')
    `).get() as { completed: string; theory: string };

    expect(JSON.parse(row.completed)).toEqual(['module-a', 'module-b']);
    expect(JSON.parse(row.theory)).toEqual(['module-a', 'module-b']);

    // No duplicate rows were created across the two saves.
    const count = db.prepare('SELECT COUNT(*) AS n FROM learning_progress').get() as { n: number };
    expect(count.n).toBe(1);
  });
});
