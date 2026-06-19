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

describe('conceptual assessment answer persistence on a legacy schema', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-learning-answers-'));
  const dbPath = path.join(tmpRoot, 'learning.sqlite');
  let db: Database;
  let server: http.Server | undefined;
  let baseUrl = '';
  let token = '';

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-learning-answers-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    const user = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    ).run('legacy-learner', 'legacy@example.com', 'hash', 'user');
    const userId = Number(user.lastInsertRowid);
    token = jwt.sign(
      { id: userId, username: 'legacy-learner', email: 'legacy@example.com', role: 'user' },
      process.env.JWT_SECRET,
    );

    db.prepare('DROP TABLE learning_question_results').run();
    db.prepare(`
      CREATE TABLE learning_question_results (
        user_id INTEGER NOT NULL,
        session_id TEXT,
        module_id TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        selected_index INTEGER NOT NULL,
        is_correct INTEGER NOT NULL,
        first_attempt_correct INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, module_id, question_index)
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

  it('records retries without an ON CONFLICT constraint error', async () => {
    const submit = (sessionId: string, selectedIndex: number, isCorrect: boolean) => fetch(
      `${baseUrl}/api/learning/answers`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          moduleId: 'module-a',
          sessionId,
          answers: [{ questionIndex: 0, selectedIndex, isCorrect }],
        }),
      },
    );

    const first = await submit('session-1', 1, false);
    expect(first.status).toBe(200);

    const retry = await submit('session-2', 0, true);
    expect(retry.status).toBe(200);

    const row = db.prepare(`
      SELECT selected_index AS selectedIndex, is_correct AS isCorrect,
             first_attempt_correct AS firstAttemptCorrect, attempts
      FROM learning_question_results
      WHERE module_id = 'module-a' AND question_index = 0
    `).get() as {
      selectedIndex: number;
      isCorrect: number;
      firstAttemptCorrect: number;
      attempts: number;
    };

    expect(row).toEqual({
      selectedIndex: 0,
      isCorrect: 1,
      firstAttemptCorrect: 0,
      attempts: 2,
    });
  });
});
