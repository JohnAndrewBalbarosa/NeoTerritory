import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import type { Database } from 'better-sqlite3';

// Isolate from production seed files (mirrors assessmentScopeRoute.test.ts).
vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

// ─── Unit tests: pure computeBloomProgression ────────────────────────────────

import { computeBloomProgression, BLOOM_RANK } from '../routes/learning';

describe('BLOOM_RANK map', () => {
  it('has correct ranks for all 6 levels', () => {
    expect(BLOOM_RANK['remembering']).toBe(1);
    expect(BLOOM_RANK['understanding']).toBe(2);
    expect(BLOOM_RANK['applying']).toBe(3);
    expect(BLOOM_RANK['analyzing']).toBe(4);
    expect(BLOOM_RANK['evaluating']).toBe(5);
    expect(BLOOM_RANK['creating']).toBe(6);
  });
});

describe('computeBloomProgression (pure unit)', () => {
  it('returns empty when no attempts', () => {
    expect(computeBloomProgression([], [])).toEqual([]);
  });

  it('returns empty when cycle has only a pretest (no posttest)', () => {
    const attempts = [{ id: 1, cycle_id: 'c1', assessment_type: 'pretest' }];
    const answers = [
      { cycle_id: 'c1', module_id: 'mod-a', assessment_type: 'pretest', question_taxonomy: 'remembering', is_correct: 1 },
    ];
    expect(computeBloomProgression(attempts, answers)).toEqual([]);
  });

  it('returns empty when cycle has only a posttest (no paired pretest)', () => {
    const attempts = [{ id: 1, cycle_id: 'c1', assessment_type: 'posttest' }];
    const answers = [
      { cycle_id: 'c1', module_id: 'mod-a', assessment_type: 'posttest', question_taxonomy: 'applying', is_correct: 1 },
    ];
    expect(computeBloomProgression(attempts, answers)).toEqual([]);
  });

  it('leveledUp = true when postHighest > preHighest', () => {
    // pre correct: understanding (2), post correct: applying (3) → leveled up
    const attempts = [
      { id: 1, cycle_id: 'c1', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c1', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c1', module_id: 'mod-a', assessment_type: 'pretest', question_taxonomy: 'understanding', is_correct: 1 },
      { cycle_id: 'c1', module_id: 'mod-a', assessment_type: 'posttest', question_taxonomy: 'applying', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result).toHaveLength(1);
    expect(result[0].moduleId).toBe('mod-a');
    expect(result[0].cycleId).toBe('c1');
    expect(result[0].preHighest).toEqual({ name: 'understanding', rank: 2 });
    expect(result[0].postHighest).toEqual({ name: 'applying', rank: 3 });
    expect(result[0].leveledUp).toBe(true);
  });

  it('leveledUp = false when postHighest <= preHighest (same level)', () => {
    const attempts = [
      { id: 1, cycle_id: 'c2', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c2', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c2', module_id: 'mod-b', assessment_type: 'pretest', question_taxonomy: 'applying', is_correct: 1 },
      { cycle_id: 'c2', module_id: 'mod-b', assessment_type: 'posttest', question_taxonomy: 'applying', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result).toHaveLength(1);
    expect(result[0].leveledUp).toBe(false);
  });

  it('leveledUp = false when postHighest < preHighest (regression)', () => {
    const attempts = [
      { id: 1, cycle_id: 'c3', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c3', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c3', module_id: 'mod-c', assessment_type: 'pretest', question_taxonomy: 'analyzing', is_correct: 1 },
      { cycle_id: 'c3', module_id: 'mod-c', assessment_type: 'posttest', question_taxonomy: 'remembering', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result[0].leveledUp).toBe(false);
  });

  it('ignores answers with is_correct != 1', () => {
    // Pre has only incorrect answers; post has a correct one.
    const attempts = [
      { id: 1, cycle_id: 'c4', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c4', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c4', module_id: 'mod-d', assessment_type: 'pretest', question_taxonomy: 'creating', is_correct: 0 },
      { cycle_id: 'c4', module_id: 'mod-d', assessment_type: 'pretest', question_taxonomy: 'creating', is_correct: null },
      { cycle_id: 'c4', module_id: 'mod-d', assessment_type: 'posttest', question_taxonomy: 'remembering', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result).toHaveLength(1);
    // preHighest = null (no correct pre answers), postHighest = remembering
    expect(result[0].preHighest).toBeNull();
    expect(result[0].postHighest).toEqual({ name: 'remembering', rank: 1 });
    // leveledUp: post rank (1) > pre rank (0) → true
    expect(result[0].leveledUp).toBe(true);
  });

  it('ignores answers with unknown taxonomy', () => {
    const attempts = [
      { id: 1, cycle_id: 'c5', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c5', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c5', module_id: 'mod-e', assessment_type: 'pretest', question_taxonomy: 'unknown-level', is_correct: 1 },
      { cycle_id: 'c5', module_id: 'mod-e', assessment_type: 'posttest', question_taxonomy: null, is_correct: 1 },
    ];
    // Both sides have no valid taxonomy → omitted
    const result = computeBloomProgression(attempts, answers);
    expect(result).toHaveLength(0);
  });

  it('picks highest rank within a side (multiple correct answers)', () => {
    const attempts = [
      { id: 1, cycle_id: 'c6', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c6', assessment_type: 'posttest' },
    ];
    const answers = [
      { cycle_id: 'c6', module_id: 'mod-f', assessment_type: 'pretest', question_taxonomy: 'remembering', is_correct: 1 },
      { cycle_id: 'c6', module_id: 'mod-f', assessment_type: 'pretest', question_taxonomy: 'understanding', is_correct: 1 },
      { cycle_id: 'c6', module_id: 'mod-f', assessment_type: 'posttest', question_taxonomy: 'analyzing', is_correct: 1 },
      { cycle_id: 'c6', module_id: 'mod-f', assessment_type: 'posttest', question_taxonomy: 'applying', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result[0].preHighest).toEqual({ name: 'understanding', rank: 2 });
    expect(result[0].postHighest).toEqual({ name: 'analyzing', rank: 4 });
    expect(result[0].leveledUp).toBe(true);
  });

  it('handles two independent modules in the same cycle', () => {
    const attempts = [
      { id: 1, cycle_id: 'c7', assessment_type: 'pretest' },
      { id: 2, cycle_id: 'c7', assessment_type: 'posttest' },
    ];
    const answers = [
      // mod-x: leveled up
      { cycle_id: 'c7', module_id: 'mod-x', assessment_type: 'pretest', question_taxonomy: 'understanding', is_correct: 1 },
      { cycle_id: 'c7', module_id: 'mod-x', assessment_type: 'posttest', question_taxonomy: 'applying', is_correct: 1 },
      // mod-y: no rise
      { cycle_id: 'c7', module_id: 'mod-y', assessment_type: 'pretest', question_taxonomy: 'analyzing', is_correct: 1 },
      { cycle_id: 'c7', module_id: 'mod-y', assessment_type: 'posttest', question_taxonomy: 'remembering', is_correct: 1 },
    ];
    const result = computeBloomProgression(attempts, answers);
    expect(result).toHaveLength(2);
    const x = result.find((r) => r.moduleId === 'mod-x')!;
    const y = result.find((r) => r.moduleId === 'mod-y')!;
    expect(x.leveledUp).toBe(true);
    expect(y.leveledUp).toBe(false);
  });
});

// ─── Integration test: GET /api/learning/bloom-progression via HTTP ──────────

describe('GET /api/learning/bloom-progression (HTTP, isolated DB)', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-bloom-'));
  const dbPath = path.join(tmpRoot, 'bloom.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let token = '';

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-bloom-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: learningRoutes } = await import('../routes/learning');
    initDb();

    // Create a test user.
    const userInfo = db
      .prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run('bloom-learner', 'bloom-learner@example.com', 'hash', 'user');
    const userId = Number(userInfo.lastInsertRowid);

    token = jwt.sign(
      { id: userId, username: 'bloom-learner', email: 'bloom-learner@example.com', role: 'user' },
      process.env.JWT_SECRET as string,
    );

    // ── Fixture: cycle-A ─────────────────────────────────────────────────────
    // Module "pattern-singleton": pre highest correct = understanding (2),
    //   post highest correct = applying (3) → leveledUp = true
    // Module "pattern-observer": pre highest correct = analyzing (4),
    //   post highest correct = remembering (1) → leveledUp = false (regression)
    const cycleId = 'cycle-bloom-a';

    const insAttempt = db.prepare(
      `INSERT INTO learning_assessment_attempts (user_id, assessment_type, question_count, cycle_id, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    );
    const preAttempt = insAttempt.run(userId, 'pretest', 4, cycleId);
    const preAttemptId = Number(preAttempt.lastInsertRowid);
    const postAttempt = insAttempt.run(userId, 'posttest', 4, cycleId);
    const postAttemptId = Number(postAttempt.lastInsertRowid);

    const insAnswer = db.prepare(
      `INSERT INTO learning_assessment_answers
         (attempt_id, user_id, assessment_type, assessment_index, module_id,
          question_index, selected_index, question_taxonomy, question_kind, is_correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    );

    // pattern-singleton pre answers
    insAnswer.run(preAttemptId, userId, 'pretest', 0, 'pattern-singleton', 0, 1, 'remembering', 'theoretical', 1);
    insAnswer.run(preAttemptId, userId, 'pretest', 1, 'pattern-singleton', 1, 0, 'understanding', 'theoretical', 1); // highest pre
    insAnswer.run(preAttemptId, userId, 'pretest', 2, 'pattern-singleton', 2, 2, 'applying', 'theoretical', 0); // wrong → excluded

    // pattern-singleton post answers
    insAnswer.run(postAttemptId, userId, 'posttest', 0, 'pattern-singleton', 0, 0, 'understanding', 'theoretical', 1);
    insAnswer.run(postAttemptId, userId, 'posttest', 1, 'pattern-singleton', 1, 1, 'applying', 'theoretical', 1); // highest post

    // pattern-observer pre answers
    insAnswer.run(preAttemptId, userId, 'pretest', 3, 'pattern-observer', 0, 3, 'analyzing', 'theoretical', 1); // highest pre

    // pattern-observer post answers
    insAnswer.run(postAttemptId, userId, 'posttest', 2, 'pattern-observer', 0, 0, 'remembering', 'theoretical', 1); // lower post

    // Start the Express app on a random port.
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
    if (server) {
      const s = server;
      await new Promise<void>((r) => s.close(() => r()));
    }
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/learning/bloom-progression`);
    expect(res.status).toBe(401);
  });

  it('returns progression array with correct shape', async () => {
    const res = await fetch(`${baseUrl}/api/learning/bloom-progression`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { progression: Array<{
      moduleId: string;
      cycleId: string;
      preHighest: { name: string; rank: number } | null;
      postHighest: { name: string; rank: number } | null;
      leveledUp: boolean;
    }> };
    expect(Array.isArray(body.progression)).toBe(true);
    expect(body.progression).toHaveLength(2);
  });

  it('pattern-singleton: leveledUp = true (understanding → applying)', async () => {
    const res = await fetch(`${baseUrl}/api/learning/bloom-progression`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { progression: Array<{ moduleId: string; preHighest: { name: string; rank: number } | null; postHighest: { name: string; rank: number } | null; leveledUp: boolean }> };
    const entry = body.progression.find((e) => e.moduleId === 'pattern-singleton');
    expect(entry).toBeDefined();
    expect(entry!.preHighest).toEqual({ name: 'understanding', rank: 2 });
    expect(entry!.postHighest).toEqual({ name: 'applying', rank: 3 });
    expect(entry!.leveledUp).toBe(true);
  });

  it('pattern-observer: leveledUp = false (analyzing → remembering)', async () => {
    const res = await fetch(`${baseUrl}/api/learning/bloom-progression`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { progression: Array<{ moduleId: string; preHighest: { name: string; rank: number } | null; postHighest: { name: string; rank: number } | null; leveledUp: boolean }> };
    const entry = body.progression.find((e) => e.moduleId === 'pattern-observer');
    expect(entry).toBeDefined();
    expect(entry!.preHighest).toEqual({ name: 'analyzing', rank: 4 });
    expect(entry!.postHighest).toEqual({ name: 'remembering', rank: 1 });
    expect(entry!.leveledUp).toBe(false);
  });

  it('incorrect answers (is_correct=0) do not raise the highest rank', async () => {
    // pattern-singleton pre had an "applying" answer that was WRONG (is_correct=0).
    // The reported pre highest must be "understanding" (rank 2), not "applying" (rank 3).
    const res = await fetch(`${baseUrl}/api/learning/bloom-progression`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { progression: Array<{ moduleId: string; preHighest: { name: string; rank: number } | null }> };
    const entry = body.progression.find((e) => e.moduleId === 'pattern-singleton');
    expect(entry!.preHighest?.rank).toBe(2); // NOT 3 (wrong answer excluded)
  });
});
