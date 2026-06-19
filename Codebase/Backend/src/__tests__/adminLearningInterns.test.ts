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

// SOP-1 PM learning records: GET /api/admin/learning/interns(/:id) expose the
// per-learner FORMAL assessment data (previously self-scoped) to admins, as RAW
// rows keyed by stable id. They must reject non-admins, separate pre/post
// attempts, and return the active plan's modules (project-relevant scope).
describe('admin PM learning record endpoints', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-pm-'));
  const dbPath = path.join(tmpRoot, 'pm.sqlite');
  let server: http.Server | undefined;
  let baseUrl = '';
  let db: Database;
  let adminToken = '';
  let userToken = '';
  let internId = 0;

  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    process.env.JWT_SECRET = 'test-pm-secret';

    db = (await import('../db/database')).default;
    const { initDb } = await import('../db/initDb');
    const { default: adminRoutes } = await import('../routes/admin');
    initDb();

    const admin = db.prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,datetime('now'))`).run('pm', 'pm@x.io', 'h', 'admin');
    const intern = db.prepare(`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,datetime('now'))`).run('intern1', 'i1@x.io', 'h', 'user');
    internId = Number(intern.lastInsertRowid);
    adminToken = jwt.sign({ id: Number(admin.lastInsertRowid), username: 'pm', email: 'pm@x.io', role: 'admin' }, process.env.JWT_SECRET as string);
    userToken = jwt.sign({ id: internId, username: 'intern1', email: 'i1@x.io', role: 'user' }, process.env.JWT_SECRET as string);

    // Active plan with two project-relevant (approved) modules.
    db.prepare(`INSERT INTO learning_plans (id, learner_id, status, activated_at) VALUES (?,?,?,datetime('now'))`).run('plan-1', internId, 'active');
    const pm = db.prepare(`INSERT INTO learning_plan_modules (plan_id, module_id, selection_status, recommendation_source, display_order) VALUES (?,?,?,?,?)`);
    pm.run('plan-1', 'behavioural-observer', 'approved', 'ai', 0);
    pm.run('plan-1', 'behavioural-strategy', 'approved', 'ai', 1);

    // A pre-test and a paired post-test in cycle 'cyc-1', with raw answers.
    const pre = db.prepare(`INSERT INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id) VALUES (?,?,?,?,?,?)`).run(internId, 's', 'pretest', 2, 'cyc-1', 'plan-1');
    const post = db.prepare(`INSERT INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id) VALUES (?,?,?,?,?,?)`).run(internId, 's', 'posttest', 2, 'cyc-1', 'plan-1');
    const ans = db.prepare(`INSERT INTO learning_assessment_answers (attempt_id, user_id, session_id, assessment_type, assessment_index, module_id, question_index, question_id, selected_index, question_kind) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    ans.run(Number(pre.lastInsertRowid), internId, 's', 'pretest', 0, 'behavioural-observer', 0, 'behavioural-observer:A1', 0, 'theoretical');
    ans.run(Number(post.lastInsertRowid), internId, 's', 'posttest', 0, 'behavioural-observer', 0, 'behavioural-observer:B1', 1, 'theoretical');

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
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

  it('rejects non-admin users', async () => {
    const res = await fetch(`${baseUrl}/api/admin/learning/interns`, { headers: { Authorization: `Bearer ${userToken}` } });
    expect(res.status).toBe(403);
    const noAuth = await fetch(`${baseUrl}/api/admin/learning/interns`);
    expect(noAuth.status).toBe(401);
  });

  it('roster lists interns with their attempts + active plan modules', async () => {
    const res = await fetch(`${baseUrl}/api/admin/learning/interns`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { interns: Array<{ internId: number; attempts: unknown[]; activePlan: { id: string } | null; planModules: Array<{ moduleId: string }> }> };
    const row = body.interns.find((i) => i.internId === internId);
    expect(row).toBeTruthy();
    expect(row!.attempts.length).toBe(2);
    expect(row!.activePlan?.id).toBe('plan-1');
    expect(new Set(row!.planModules.map((m) => m.moduleId))).toEqual(new Set(['behavioural-observer', 'behavioural-strategy']));
  });

  it('detail returns pre/post attempts separately, raw answers, and plan modules', async () => {
    const res = await fetch(`${baseUrl}/api/admin/learning/interns/${internId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: { internId: number };
      plans: Array<{ id: string; status: string; modules: Array<{ moduleId: string }> }>;
      attempts: Array<{ assessmentType: string; cycleId: string }>;
      answers: Array<{ assessmentType: string; questionId: string | null; moduleId: string }>;
    };
    expect(body.profile.internId).toBe(internId);
    // pre/post are SEPARATE attempt rows, not one generic metric.
    const types = body.attempts.map((a) => a.assessmentType).sort();
    expect(types).toEqual(['posttest', 'pretest']);
    // both attempts share the same cycle id (paired by cycle).
    expect(new Set(body.attempts.map((a) => a.cycleId))).toEqual(new Set(['cyc-1']));
    // raw answers carry stable question ids for both forms.
    expect(body.answers.some((a) => a.questionId === 'behavioural-observer:A1' && a.assessmentType === 'pretest')).toBe(true);
    expect(body.answers.some((a) => a.questionId === 'behavioural-observer:B1' && a.assessmentType === 'posttest')).toBe(true);
    // active plan modules (project-relevant scope) present.
    const active = body.plans.find((p) => p.status === 'active');
    expect(active).toBeTruthy();
    expect(new Set(active!.modules.map((m) => m.moduleId))).toEqual(new Set(['behavioural-observer', 'behavioural-strategy']));
  });

  it('returns 404 for an unknown intern and 400 for a bad id', async () => {
    expect((await fetch(`${baseUrl}/api/admin/learning/interns/99999`, { headers: { Authorization: `Bearer ${adminToken}` } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/admin/learning/interns/abc`, { headers: { Authorization: `Bearer ${adminToken}` } })).status).toBe(400);
  });
});
