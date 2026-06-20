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

// Server-side Post-Test release guards: the assessments route + the unique
// (user, cycle, type) index together guarantee that pairing and idempotency
// cannot be bypassed by direct API calls, refreshes, double-clicks, or another
// learner's token. (Grading-aware "required modules complete" gating lives in
// the frontend because the question bank is frontend-only by design.)
describe('Post-Test release — server guards', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-posttest-'));
  const dbPath = path.join(tmpRoot, 'posttest.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let learnerA = 0;
  let learnerB = 0;

  const tokenFor = (id: number, username: string) =>
    jwt.sign({ id, username, email: `${username}@example.com`, role: 'user' }, process.env.JWT_SECRET as string);

  const putAssessment = (token: string, body: unknown) =>
    fetch(`${baseUrl}/api/learning/assessments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const oneAnswer = (moduleId: string) => [{
    moduleId, questionIndex: 0, questionId: `${moduleId}:A1`, selectedIndex: 0,
    responseText: '', questionTaxonomy: 'remember', questionKind: 'theoretical',
  }];

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-posttest-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    const ins = db.prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, 'user', datetime('now'))`);
    learnerA = Number(ins.run('learnerA', 'learnerA@example.com', 'hash').lastInsertRowid);
    learnerB = Number(ins.run('learnerB', 'learnerB@example.com', 'hash').lastInsertRowid);

    const app = express();
    app.use(express.json());
    app.use('/api/learning', learningRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server?.address();
        if (!addr || typeof addr === 'string') throw new Error('bind failed');
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) { const s = server; await new Promise<void>((r) => s.close(() => r())); }
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('(17) rejects a Post-Test with no paired Pre-Test in the cycle (direct API)', async () => {
    const res = await putAssessment(tokenFor(learnerA, 'learnerA'), {
      assessmentType: 'posttest', cycleId: 'cycX', planId: 'plan-1', answers: oneAnswer('behavioural-strategy'),
    });
    expect(res.status).toBe(409);
  });

  it('(13,14) does not create a duplicate Pre-Test attempt for the same cycle', async () => {
    const token = tokenFor(learnerA, 'learnerA');
    const first = await putAssessment(token, { assessmentType: 'pretest', cycleId: 'cyc1', planId: 'plan-1', answers: oneAnswer('behavioural-strategy') });
    expect(first.status).toBe(200);
    // A refresh / double-click re-submits the same cycle+type → rejected, never duplicated.
    const second = await putAssessment(token, { assessmentType: 'pretest', cycleId: 'cyc1', planId: 'plan-1', answers: oneAnswer('behavioural-strategy') });
    expect(second.status).toBe(409);

    const rows = db.prepare(`SELECT COUNT(*) AS n FROM learning_assessment_attempts WHERE user_id = ? AND cycle_id = ? AND assessment_type = 'pretest'`).get(learnerA, 'cyc1') as { n: number };
    expect(rows.n).toBe(1);
  });

  it('(3,16) allows exactly one Post-Test per cycle and rejects a second (no accidental restart)', async () => {
    const token = tokenFor(learnerA, 'learnerA');
    const ok = await putAssessment(token, { assessmentType: 'posttest', cycleId: 'cyc1', planId: 'plan-1', answers: oneAnswer('behavioural-strategy') });
    expect(ok.status).toBe(200);
    const again = await putAssessment(token, { assessmentType: 'posttest', cycleId: 'cyc1', planId: 'plan-1', answers: oneAnswer('behavioural-strategy') });
    expect(again.status).toBe(409);
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM learning_assessment_attempts WHERE user_id = ? AND cycle_id = ? AND assessment_type = 'posttest'`).get(learnerA, 'cyc1') as { n: number };
    expect(rows.n).toBe(1);
  });

  it('(18) a learner cannot read or write another learner’s cycle attempts', async () => {
    // learnerB writes their OWN pretest in a same-named cycle; rows stay scoped
    // to each user_id, so learnerB never touches learnerA's cyc1 attempts.
    const bToken = tokenFor(learnerB, 'learnerB');
    const bPre = await putAssessment(bToken, { assessmentType: 'pretest', cycleId: 'cyc1', planId: 'plan-1', answers: oneAnswer('creational-builder') });
    expect(bPre.status).toBe(200); // not blocked by learnerA's identically-named cycle

    const get = await fetch(`${baseUrl}/api/learning/assessments`, { headers: { Authorization: `Bearer ${bToken}` } });
    const body = await get.json() as { attempts: Array<{ cycleId: string; assessmentType: string }> };
    // learnerB sees ONLY their own attempts (one pretest), never learnerA's posttest.
    expect(body.attempts.every((a) => a.assessmentType === 'pretest')).toBe(true);
    expect(body.attempts.length).toBe(1);

    const aOnly = db.prepare(`SELECT COUNT(*) AS n FROM learning_assessment_attempts WHERE user_id = ?`).get(learnerA) as { n: number };
    const bOnly = db.prepare(`SELECT COUNT(*) AS n FROM learning_assessment_attempts WHERE user_id = ?`).get(learnerB) as { n: number };
    expect(aOnly.n).toBe(2); // pretest + posttest
    expect(bOnly.n).toBe(1); // pretest only
  });

  it('enforces the unique formal-attempt index at the DB level', () => {
    const cols = db.prepare(`PRAGMA index_list(learning_assessment_attempts)`).all() as Array<{ name: string; unique: number }>;
    expect(cols.some((c) => c.name === 'uniq_learning_assessment_attempt_cycle_type' && c.unique === 1)).toBe(true);
  });
});
