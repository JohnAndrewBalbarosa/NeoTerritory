import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import type { Database } from 'better-sqlite3';

vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

// GET /api/learning/assessment-scope is the SERVER-SIDE authority for the
// project-guided pre-test scope: it returns the stable ids of modules whose
// Courses toggle is ON (published = 1). An OFF module (incl. an unpublished
// foundation) is excluded; an ON module is included regardless of category.
describe('GET /api/learning/assessment-scope (enabled course-module toggles)', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-scope-'));
  const dbPath = path.join(tmpRoot, 'scope.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let token = '';

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-scope-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    const userInfo = db
      .prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run('learner', 'scope-learner@example.com', 'hash', 'user');
    token = jwt.sign(
      { id: Number(userInfo.lastInsertRowid), username: 'learner', email: 'scope-learner@example.com', role: 'user' },
      process.env.JWT_SECRET as string,
    );

    // Deterministic fixture: 1 published pattern module ON, 1 unpublished pattern
    // module OFF, 1 unpublished foundation OFF. Replace any seeded rows so the
    // assertion set is exact.
    db.prepare('DELETE FROM learning_modules').run();
    const ins = db.prepare(
      `INSERT INTO learning_modules (module_id, category, title, published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    );
    ins.run('behavioural-observer', 'behavioural', 'Observer', 1, 0); // ON
    ins.run('behavioural-strategy', 'behavioural', 'Strategy', 0, 1);  // OFF
    ins.run('foundations-ambiguity', 'foundations', 'Ambiguity', 0, 2); // OFF foundation

    const app = express();
    app.use(express.json());
    app.use('/api/learning', learningRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const a = server?.address();
        if (!a || typeof a === 'string') throw new Error('failed to bind test server');
        baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) { const s = server; await new Promise<void>((r) => s.close(() => r())); }
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/learning/assessment-scope`);
    expect(res.status).toBe(401);
  });

  it('returns only ON (published) module ids; OFF modules (incl. foundations) excluded', async () => {
    const res = await fetch(`${baseUrl}/api/learning/assessment-scope`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { moduleIds: string[] };
    expect(body.moduleIds).toEqual(['behavioural-observer']);
    expect(body.moduleIds).not.toContain('behavioural-strategy'); // OFF
    expect(body.moduleIds).not.toContain('foundations-ambiguity'); // OFF foundation not force-included
  });

  it('reflects a toggle change (OFF→ON) on the next request', async () => {
    db.prepare(`UPDATE learning_modules SET published = 1 WHERE module_id = ?`).run('behavioural-strategy');
    const res = await fetch(`${baseUrl}/api/learning/assessment-scope`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { moduleIds: string[] };
    expect(new Set(body.moduleIds)).toEqual(new Set(['behavioural-observer', 'behavioural-strategy']));
  });
});
