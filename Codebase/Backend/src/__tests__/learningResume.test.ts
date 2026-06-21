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

// Resume position: a lightweight "where the learner stopped" record kept on the
// learning_progress row. It must be idempotent (no duplicate rows), must NEVER
// overwrite completion/assessment data, and must be scoped to the learner.
describe('learning resume endpoint', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-resume-'));
  const dbPath = path.join(tmpRoot, 'resume.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let token = '';
  let userId = 0;
  const SID = 'lms-session-1';

  const put = (body: unknown, auth = token) =>
    fetch(`${baseUrl}/api/learning/resume`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    });
  const getProgress = (): Promise<any> =>
    fetch(`${baseUrl}/api/learning/progress`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-resume-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    const u = db.prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,datetime('now'))`).run('learner', 'l@x.io', 'h', 'user');
    userId = Number(u.lastInsertRowid);
    token = jwt.sign({ id: userId, username: 'learner', email: 'l@x.io', role: 'user' }, process.env.JWT_SECRET as string);

    // Seed a real progress row with completion data we must never clobber.
    db.prepare(
      `INSERT INTO learning_progress (user_id, session_id, completed_module_ids, last_unlocked_module_id, theory_passed_module_ids)
       VALUES (?,?,?,?,?)`,
    ).run(userId, SID, JSON.stringify(['foundations-a', 'foundations-b']), 'creational-singleton', JSON.stringify(['foundations-a']));

    const app = express();
    app.use(express.json());
    app.use('/api/learning', learningRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const a = server?.address();
        if (!a || typeof a === 'string') throw new Error('bind failed');
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

  it('requires auth and a moduleId', async () => {
    expect((await put({ sessionId: SID, moduleId: 'creational-singleton' }, '')).status).toBe(401);
    expect((await put({ sessionId: SID }, token)).status).toBe(400);
  });

  it('saves the resume position and returns it from GET /progress', async () => {
    const res = await put({ sessionId: SID, moduleId: 'creational-singleton', category: 'creational', stage: 'lesson', cycleId: 'cyc-1' });
    expect(res.status).toBe(200);
    const prog = await getProgress();
    expect(prog.resume).toMatchObject({ moduleId: 'creational-singleton', category: 'creational', stage: 'lesson', cycleId: 'cyc-1' });
  });

  it('does NOT overwrite completion / unlock / assessment data', async () => {
    await put({ sessionId: SID, moduleId: 'creational-builder', stage: 'theoretical', cycleId: 'cyc-1' });
    const prog = await getProgress();
    // Resume moved, but completion + unlock are exactly as seeded.
    expect(prog.completedModuleIds).toEqual(['foundations-a', 'foundations-b']);
    expect(prog.lastUnlockedModuleId).toBe('creational-singleton');
    expect(prog.theoryPassedModuleIds).toEqual(['foundations-a']);
    expect(prog.resume).toMatchObject({ moduleId: 'creational-builder', stage: 'theoretical' });
  });

  it('is idempotent — repeated saves never create duplicate progress rows', async () => {
    for (let i = 0; i < 4; i += 1) {
      await put({ sessionId: SID, moduleId: 'creational-singleton', stage: 'lesson', cycleId: 'cyc-1' });
    }
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM learning_progress WHERE user_id = ? AND session_id IS ?`).get(userId, SID) as { n: number };
    expect(rows.n).toBe(1);
  });

  it('records the cycle id so the client can guard cross-cycle restore', async () => {
    await put({ sessionId: SID, moduleId: 'creational-singleton', stage: 'lesson', cycleId: 'cyc-OTHER' });
    const prog = await getProgress();
    expect(prog.resume.cycleId).toBe('cyc-OTHER');
  });

  it('coerces an invalid stage to "lesson"', async () => {
    await put({ sessionId: SID, moduleId: 'creational-singleton', stage: 'hacking', cycleId: 'cyc-1' });
    const prog = await getProgress();
    expect(prog.resume.stage).toBe('lesson');
  });

  it('creates a resume row for a learner who has no progress row yet', async () => {
    const u2 = db.prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,datetime('now'))`).run('fresh', 'f@x.io', 'h', 'user');
    const id2 = Number(u2.lastInsertRowid);
    const t2 = jwt.sign({ id: id2, username: 'fresh', email: 'f@x.io', role: 'user' }, process.env.JWT_SECRET as string);
    const res = await fetch(`${baseUrl}/api/learning/resume`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ sessionId: 'lms-2', moduleId: 'foundations-a', stage: 'lesson' }),
    });
    expect(res.status).toBe(200);
    const prog = await fetch(`${baseUrl}/api/learning/progress`, { headers: { Authorization: `Bearer ${t2}` } }).then((r) => r.json() as Promise<any>);
    expect(prog.resume).toMatchObject({ moduleId: 'foundations-a', stage: 'lesson' });
    expect(prog.completedModuleIds).toEqual([]); // fresh learner, no completion
  });
});
