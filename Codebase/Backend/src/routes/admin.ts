import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { logAudit } from '../services/logService';

// Pre-hashed bcrypt of the log-delete password. Override via LOG_DELETE_HASH env var.
const LOG_DELETE_HASH = process.env.LOG_DELETE_HASH
  || '$2b$10$qnhM98kPsdOqV6/8QpBADeG6aTbjmKph0d1twnLFwuRT7doNvpvP.';

const router = express.Router();

router.use(jwtAuth, requireAdmin);

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return null; }
}

interface CountRow { c: number }
interface AvgRow { a: number | null }

router.get('/users', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_active,
             COUNT(r.id) AS runCount,
             MAX(r.created_at) AS lastRunAt
      FROM users u
      LEFT JOIN analysis_runs r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY runCount DESC, u.username ASC
    `).all();
    res.json({ users: rows });
  } catch (err) { next(err); }
});

// Five-minute window matches the admin UI's "online" indicator. A user with no
// last_active row, or last_active older than this, is considered offline and
// safe to reset without dropping their session.
const ONLINE_WINDOW_SECONDS = 5 * 60;

interface ResetSeatsBody {
  userIds?: unknown;
  offlineOnly?: unknown;
}

router.post('/tester-seats/reset', (req: Request<unknown, unknown, ResetSeatsBody>, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
    const userIds = rawIds
      .map((v) => Number(v))
      .filter((n): n is number => Number.isFinite(n) && n > 0);
    const offlineOnly = body.offlineOnly === true;

    let result: { changes: number };
    if (userIds.length) {
      // Selected reset: only Devcon* tester rows can have their seat freed,
      // even if the admin sends a non-tester id.
      const placeholders = userIds.map(() => '?').join(',');
      result = db.prepare(
        `UPDATE users SET claimed_at = NULL
         WHERE username LIKE 'Devcon%' AND id IN (${placeholders})`
      ).run(...userIds);
    } else if (offlineOnly) {
      // Offline reset: only tester accounts that have not pinged within the
      // online window. NULL last_active counts as offline.
      result = db.prepare(
        `UPDATE users SET claimed_at = NULL
         WHERE username LIKE 'Devcon%'
           AND (last_active IS NULL
                OR strftime('%s','now') - strftime('%s', last_active) >= ?)`
      ).run(ONLINE_WINDOW_SECONDS);
    } else {
      result = db.prepare("UPDATE users SET claimed_at = NULL WHERE username LIKE 'Devcon%'").run();
    }
    res.json({ ok: true, reset: result.changes });
  } catch (err) { next(err); }
});

router.get('/users/:id/runs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const rows = db.prepare(`
      SELECT id, source_name, structure_score, modernization_score, findings_count, created_at
      FROM analysis_runs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(req.params.id, limit);
    res.json({ runs: rows });
  } catch (err) { next(err); }
});

interface AdminRunRow {
  id: number;
  username: string | null;
  source_name: string;
  source_text: string;
  analysis_json: string;
  artifact_path: string;
  findings_count: number;
  created_at: string;
}

// Cross-user run list for the admin Runs panel. Excludes admin-authored
// runs from the result so the listing is consistent with the overview totals.
router.get('/runs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const rows = db.prepare(`
      SELECT r.id, r.source_name, r.findings_count, r.created_at, u.username
      FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE u.role IS NULL OR u.role != 'admin'
      ORDER BY r.id DESC
      LIMIT ?
    `).all(limit);
    res.json({ runs: rows });
  } catch (err) { next(err); }
});

router.get('/runs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = db.prepare(`
      SELECT r.*, u.username
      FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `).get(req.params.id) as AdminRunRow | undefined;
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json({
      id: run.id,
      username: run.username,
      sourceName: run.source_name,
      sourceText: run.source_text,
      analysis: safeParse(run.analysis_json),
      artifactPath: run.artifact_path,
      findingsCount: run.findings_count,
      createdAt: run.created_at
    });
  } catch (err) { next(err); }
});

router.get('/stats/overview', (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Admins are excluded from totals — the dashboard is meant to summarize
    // tester activity, not operator presence. Runs from admin accounts are
    // also dropped from totals/avgs for the same reason.
    const totalUsers = (db.prepare(
      `SELECT COUNT(*) AS c FROM users WHERE role IS NULL OR role != 'admin'`
    ).get() as CountRow).c;
    const totalRuns = (db.prepare(`
      SELECT COUNT(*) AS c FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE u.role IS NULL OR u.role != 'admin'
    `).get() as CountRow).c;
    const runsToday = (db.prepare(`
      SELECT COUNT(*) AS c FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE date(r.created_at) = date('now')
        AND (u.role IS NULL OR u.role != 'admin')
    `).get() as CountRow).c;
    const totalReviews = (db.prepare(`
      SELECT COUNT(*) AS c FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
      WHERE u.role IS NULL OR u.role != 'admin'
    `).get() as CountRow).c;
    const avgFindings = (db.prepare(`
      SELECT AVG(r.findings_count) AS a FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE u.role IS NULL OR u.role != 'admin'
    `).get() as AvgRow).a;
    res.json({
      totalUsers,
      totalRuns,
      runsToday,
      totalReviews,
      avgFindings: avgFindings ? Number(avgFindings.toFixed(2)) : 0
    });
  } catch (err) { next(err); }
});

interface RunsPerDayRow { date: string; count: number }

router.get('/stats/runs-per-day', (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 7), 1), 180);
    const rows = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count
      FROM analysis_runs
      WHERE date(created_at) >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(`-${days - 1} days`) as RunsPerDayRow[];
    const map = new Map(rows.map((r) => [r.date, r.count]));
    const series: Array<{ date: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: map.get(key) || 0 });
    }
    res.json({ series });
  } catch (err) { next(err); }
});

interface AnalysisJsonRow { analysis_json: string }

router.get('/stats/pattern-frequency', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT analysis_json FROM analysis_runs`).all() as AnalysisJsonRow[];
    interface FreqRow { pattern: string; family: string; displayName: string; count: number }
    const counts = new Map<string, FreqRow>();
    for (const row of rows) {
      const a = safeParse(row.analysis_json) as {
        detectedPatterns?: Array<{ patternName?: string; patternId?: string }>
      } | null;
      const patterns = (a && a.detectedPatterns) || [];
      for (const p of patterns) {
        // Prefer patternId because it carries the catalog folder name
        // (`<family>.<name>` — derived from Microservice/pattern_catalog/<family>/),
        // which is what the admin family pie needs to bucket. Fall back to
        // patternName when the microservice didn't emit an id.
        const id = p.patternId || p.patternName || 'unknown';
        const family = id.includes('.') ? id.split('.')[0].toLowerCase() : 'other';
        const display = p.patternName || id;
        const key = id;
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { pattern: key, family, displayName: display, count: 1 });
      }
    }
    const series = [...counts.values()].sort((a, b) => b.count - a.count);
    res.json({ series });
  } catch (err) { next(err); }
});

interface FindingsCountRow { findings_count: number }

router.get('/stats/score-distribution', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT findings_count FROM analysis_runs`).all() as FindingsCountRow[];
    const buckets: Record<string, number> = { '0': 0, '1-2': 0, '3-5': 0, '6-10': 0, '11+': 0 };
    for (const r of rows) {
      const n = r.findings_count || 0;
      if (n === 0) buckets['0']!++;
      else if (n <= 2) buckets['1-2']!++;
      else if (n <= 5) buckets['3-5']!++;
      else if (n <= 10) buckets['6-10']!++;
      else buckets['11+']!++;
    }
    res.json({
      buckets: Object.entries(buckets).map(([range, count]) => ({ range, count }))
    });
  } catch (err) { next(err); }
});

interface PerUserRow { username: string; runs: number; avgFindings: number | null }

router.get('/stats/per-user-activity', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`
      SELECT u.username,
             COUNT(r.id) AS runs,
             AVG(r.findings_count) AS avgFindings
      FROM users u
      LEFT JOIN analysis_runs r ON r.user_id = u.id
      GROUP BY u.id
      HAVING runs > 0
      ORDER BY runs DESC
      LIMIT 20
    `).all() as PerUserRow[];
    res.json({
      series: rows.map((r) => ({
        username: r.username,
        runs: r.runs,
        avgFindings: r.avgFindings ? Number(r.avgFindings.toFixed(2)) : 0
      }))
    });
  } catch (err) { next(err); }
});

router.get('/logs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit     = Math.min(Number(req.query.limit || 200), 500);
    const order     = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const eventType = req.query.event_type ? String(req.query.event_type) : null;
    const username  = req.query.username   ? `%${String(req.query.username)}%` : null;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    if (eventType) { conditions.push('l.event_type = ?'); params.push(eventType); }
    if (username)  { conditions.push('u.username LIKE ?'); params.push(username); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const rows = db.prepare(`
      SELECT l.id, l.user_id, l.event_type, l.message, l.created_at, u.username
      FROM logs l
      LEFT JOIN users u ON u.id = l.user_id
      ${where}
      ORDER BY l.id ${order}
      LIMIT ?
    `).all(...params);
    res.json({ logs: rows });
  } catch (err) { next(err); }
});

router.delete('/logs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || password.length > 128) {
      res.status(400).json({ error: 'password required' });
      return;
    }
    const ok = bcrypt.compareSync(password, LOG_DELETE_HASH);
    if (!ok) {
      res.status(403).json({ error: 'Wrong password' });
      return;
    }
    // Cascade: clearing logs also clears the activity it summarises —
    // analysis_runs, reviews, and survey responses — so dashboards driven
    // by those tables (run-count, pattern frequency, per-user activity)
    // reset together. The audit_log row below is the immutable record of
    // exactly what got purged.
    // FULL CASCADE — every activity table the user could mean by "all
    // logs". Walks the FK dependency order so SQLite never throws a
    // FOREIGN KEY constraint failure. We deliberately keep `users`
    // (sign-in identities) and `audit_log` (immutable accountability
    // record of THIS very purge) — wiping either would break the
    // session and erase the proof that the purge happened. Anything
    // else activity-related goes.
    const safeDelete = (sql: string): number => {
      try { return db.prepare(sql).run().changes; }
      catch { return 0; }   // table missing on older DBs / fresh installs
    };
    const tx = db.transaction(() => {
      const r = {
        logs: 0, runs: 0, reviews: 0, surveys: 0, decisions: 0,
        consent: 0, pretest: 0, runFeedback: 0, sessionFeedback: 0, jobs: 0
      };
      // 1) Tables that REFERENCE analysis_runs(id) — must die first.
      r.decisions       = safeDelete('DELETE FROM manual_pattern_decisions');
      r.reviews         = safeDelete('DELETE FROM reviews');
      // 2) Tables that REFERENCE users(id) but not analysis_runs.
      r.consent         = safeDelete('DELETE FROM survey_consent');
      r.pretest         = safeDelete('DELETE FROM survey_pretest');
      r.runFeedback     = safeDelete('DELETE FROM run_feedback');
      r.sessionFeedback = safeDelete('DELETE FROM session_feedback');
      r.jobs            = safeDelete('DELETE FROM jobs');
      // 3) Top-level activity tables (no FKs pointing at them now).
      r.surveys         = safeDelete('DELETE FROM survey_responses');
      r.runs            = safeDelete('DELETE FROM analysis_runs');
      r.logs            = safeDelete('DELETE FROM logs');
      return r;
    });
    const r = tx();
    const changes = r.logs;
    const detail = `logs=${r.logs} runs=${r.runs} reviews=${r.reviews} `
                 + `surveys=${r.surveys} decisions=${r.decisions} `
                 + `consent=${r.consent} pretest=${r.pretest} `
                 + `runFeedback=${r.runFeedback} sessionFeedback=${r.sessionFeedback} `
                 + `jobs=${r.jobs}`;
    logAudit({
      actorUserId:   req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action:        'delete',
      targetKind:    'logs.bulk_cascade',
      targetId:      null,
      detail
    });
    res.json({ ok: true, deleted: changes, detail });
  } catch (err) { next(err); }
});

// Delete a single analysis run + its associated reviews. Admin only. The
// removal is auditable via /admin/audit (which has no DELETE counterpart),
// so deleting a run for "metrics cleanup" still leaves a permanent trace.
router.delete('/runs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'invalid run id' });
      return;
    }
    const row = db.prepare('SELECT id, source_name, user_id FROM analysis_runs WHERE id = ?').get(id) as
      { id: number; source_name: string; user_id: number | null } | undefined;
    if (!row) { res.status(404).json({ error: 'Run not found' }); return; }
    // The schema migration in initDb.ts gave reviews + manual_pattern_decisions
    // an `ON DELETE CASCADE` to analysis_runs, so a single DELETE is
    // enough — SQLite walks the dependents itself. We still keep an
    // explicit transaction so this is atomic.
    db.transaction(() => {
      db.prepare('DELETE FROM analysis_runs WHERE id = ?').run(id);
    })();
    logAudit({
      actorUserId:   req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action:        'delete',
      targetKind:    'analysis_run',
      targetId:      String(id),
      detail:        `source=${row.source_name} owner_user_id=${row.user_id ?? 'null'}`
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Read-only audit log feed. There is no DELETE/UPDATE route on this table —
// the entries are accountability for destructive admin actions.
router.get('/audit', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const rows = db.prepare(`
      SELECT id, actor_user_id, actor_username, action, target_kind, target_id, detail, created_at
      FROM audit_log
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
    res.json({ entries: rows });
  } catch (err) { next(err); }
});

interface ReviewListRow {
  id: number;
  scope: string;
  analysis_run_id: number | null;
  answers_json: string;
  schema_version: string;
  created_at: string;
  username: string | null;
  source_name: string | null;
}

router.get('/reviews', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const rows = db.prepare(`
      SELECT rv.id, rv.scope, rv.analysis_run_id, rv.answers_json, rv.schema_version, rv.created_at,
             u.username, ar.source_name
      FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
      LEFT JOIN analysis_runs ar ON ar.id = rv.analysis_run_id
      ORDER BY rv.id DESC
      LIMIT ?
    `).all(limit) as ReviewListRow[];
    res.json({
      reviews: rows.map((r) => ({
        id: r.id,
        scope: r.scope,
        analysisRunId: r.analysis_run_id,
        sourceName: r.source_name,
        username: r.username,
        schemaVersion: r.schema_version,
        answers: safeParse(r.answers_json) || {},
        createdAt: r.created_at
      }))
    });
  } catch (err) { next(err); }
});

// ─── Survey summary ──────────────────────────────────────────────────────────

interface ReviewRow { scope: string; answers_json: string }

// ── Per-run feedback rows (run_feedback table) ───────────────────────────────
// One row per submitted per-run review. Joins users for the username column
// and analysis_runs for the source filename so the admin sees WHO rated WHICH
// submission. The Likert ratings + open-ended answers come back as parsed
// JSON maps so the frontend can render them directly.
interface PerRunFeedbackRow {
  id: number;
  run_id: string;
  user_id: number | null;
  username: string | null;
  source_name: string | null;
  ratings_json: string;
  open_json: string;
  submitted_at: string;
}
router.get('/stats/per-run-feedback', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`
      SELECT rf.id, rf.run_id, rf.user_id, u.username,
             ar.source_name,
             rf.ratings_json, rf.open_json, rf.submitted_at
      FROM run_feedback rf
      LEFT JOIN users u ON u.id = rf.user_id
      LEFT JOIN analysis_runs ar ON CAST(ar.id AS TEXT) = rf.run_id
      ORDER BY rf.submitted_at DESC
    `).all() as PerRunFeedbackRow[];
    res.json({
      rows: rows.map(r => ({
        id:          r.id,
        runId:       r.run_id,
        runSourceName: r.source_name,
        username:    r.username,
        ratings:     safeParse(r.ratings_json) || {},
        openEnded:   safeParse(r.open_json) || {},
        submittedAt: r.submitted_at
      }))
    });
  } catch (err) { next(err); }
});

// ── Per-sign-out feedback (session_feedback) ─────────────────────────────────
interface PerSessionFeedbackRow {
  id: number;
  session_uuid: string;
  user_id: number | null;
  username: string | null;
  ratings_json: string;
  open_json: string;
  submitted_at: string;
}
router.get('/stats/per-session-feedback', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`
      SELECT sf.id, sf.session_uuid, sf.user_id, u.username,
             sf.ratings_json, sf.open_json, sf.submitted_at
      FROM session_feedback sf
      LEFT JOIN users u ON u.id = sf.user_id
      ORDER BY sf.submitted_at DESC
    `).all() as PerSessionFeedbackRow[];
    res.json({
      rows: rows.map(r => ({
        id:          r.id,
        sessionUuid: r.session_uuid,
        username:    r.username,
        ratings:     safeParse(r.ratings_json) || {},
        openEnded:   safeParse(r.open_json) || {},
        submittedAt: r.submitted_at
      }))
    });
  } catch (err) { next(err); }
});

// ── Open-ended text answers (combined across all three sources) ──────────────
// Walks every text-typed value out of run_feedback.open_json,
// session_feedback.open_json, AND the legacy reviews.answers_json so the
// admin can see EVERY free-text response in one list. Each row keeps its
// origin so the operator knows whether the user wrote it during a run or
// at sign-out.
interface OpenEndedRow {
  id: number;
  source: 'per-run' | 'per-session' | 'review';
  username: string | null;
  runId?: string;
  sessionUuid?: string;
  questionId: string;
  text: string;
  submittedAt: string;
}
router.get('/stats/open-ended', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const out: OpenEndedRow[] = [];

    function pushTextAnswers(
      source: OpenEndedRow['source'],
      meta: { id: number; username: string | null; runId?: string; sessionUuid?: string; submittedAt: string },
      json: string | null | undefined
    ): void {
      const parsed = safeParse(json || '{}') as Record<string, unknown> | null;
      if (!parsed) return;
      for (const [qid, value] of Object.entries(parsed)) {
        if (typeof value !== 'string' || value.trim().length === 0) continue;
        out.push({
          id: meta.id,
          source,
          username: meta.username,
          runId: meta.runId,
          sessionUuid: meta.sessionUuid,
          questionId: qid,
          text: value,
          submittedAt: meta.submittedAt
        });
      }
    }

    const perRun = db.prepare(`
      SELECT rf.id, rf.run_id, u.username, rf.open_json, rf.submitted_at
      FROM run_feedback rf
      LEFT JOIN users u ON u.id = rf.user_id
    `).all() as Array<{ id: number; run_id: string; username: string | null; open_json: string; submitted_at: string }>;
    for (const r of perRun) {
      pushTextAnswers('per-run', { id: r.id, username: r.username, runId: r.run_id, submittedAt: r.submitted_at }, r.open_json);
    }

    const perSess = db.prepare(`
      SELECT sf.id, sf.session_uuid, u.username, sf.open_json, sf.submitted_at
      FROM session_feedback sf
      LEFT JOIN users u ON u.id = sf.user_id
    `).all() as Array<{ id: number; session_uuid: string; username: string | null; open_json: string; submitted_at: string }>;
    for (const r of perSess) {
      pushTextAnswers('per-session', { id: r.id, username: r.username, sessionUuid: r.session_uuid, submittedAt: r.submitted_at }, r.open_json);
    }

    const reviews = db.prepare(`
      SELECT rv.id, u.username, rv.answers_json, rv.created_at
      FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
    `).all() as Array<{ id: number; username: string | null; answers_json: string; created_at: string }>;
    for (const r of reviews) {
      pushTextAnswers('review', { id: r.id, username: r.username, submittedAt: r.created_at }, r.answers_json);
    }

    out.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    res.json({ rows: out });
  } catch (err) { next(err); }
});

// ── XLSX export — three sheets in one workbook ──────────────────────────────
// Per-run Likert + Per-sign-out Likert + Open-ended. Sheets are SKIPPED
// when their underlying table is empty so the operator never sees a
// header row with no data. Filename is date-stamped so repeated exports
// don't overwrite each other in the user's downloads folder.
router.get('/stats/survey-export.xlsx', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NeoTerritory admin';
    workbook.created = new Date();

    interface PerRunRow { id: number; run_id: string; username: string | null;
                          source_name: string | null; ratings_json: string;
                          open_json: string; submitted_at: string }
    const perRunRows = db.prepare(`
      SELECT rf.id, rf.run_id, u.username, ar.source_name,
             rf.ratings_json, rf.open_json, rf.submitted_at
      FROM run_feedback rf
      LEFT JOIN users u ON u.id = rf.user_id
      LEFT JOIN analysis_runs ar ON CAST(ar.id AS TEXT) = rf.run_id
      ORDER BY rf.submitted_at ASC
    `).all() as PerRunRow[];

    if (perRunRows.length > 0) {
      const sheet = workbook.addWorksheet('Per-run Likert');
      const ratingKeys = collectKeys(perRunRows.map(r => safeParse(r.ratings_json) as Record<string, unknown> | null));
      sheet.columns = [
        { header: 'username',     key: 'username',     width: 16 },
        { header: 'runId',        key: 'runId',        width: 10 },
        { header: 'sourceName',   key: 'sourceName',   width: 24 },
        { header: 'submittedAt',  key: 'submittedAt',  width: 22 },
        ...ratingKeys.map(k => ({ header: k, key: k, width: 8 }))
      ];
      for (const r of perRunRows) {
        const ratings = (safeParse(r.ratings_json) as Record<string, number>) || {};
        sheet.addRow({
          username: r.username || '',
          runId: r.run_id,
          sourceName: r.source_name || '',
          submittedAt: r.submitted_at,
          ...ratings
        });
      }
    }

    interface PerSessRow { id: number; session_uuid: string; username: string | null;
                           ratings_json: string; open_json: string; submitted_at: string }
    const perSessRows = db.prepare(`
      SELECT sf.id, sf.session_uuid, u.username,
             sf.ratings_json, sf.open_json, sf.submitted_at
      FROM session_feedback sf
      LEFT JOIN users u ON u.id = sf.user_id
      ORDER BY sf.submitted_at ASC
    `).all() as PerSessRow[];

    if (perSessRows.length > 0) {
      const sheet = workbook.addWorksheet('Per-sign-out Likert');
      const ratingKeys = collectKeys(perSessRows.map(r => safeParse(r.ratings_json) as Record<string, unknown> | null));
      sheet.columns = [
        { header: 'username',    key: 'username',    width: 16 },
        { header: 'sessionUuid', key: 'sessionUuid', width: 36 },
        { header: 'submittedAt', key: 'submittedAt', width: 22 },
        ...ratingKeys.map(k => ({ header: k, key: k, width: 8 }))
      ];
      for (const r of perSessRows) {
        const ratings = (safeParse(r.ratings_json) as Record<string, number>) || {};
        sheet.addRow({
          username: r.username || '',
          sessionUuid: r.session_uuid,
          submittedAt: r.submitted_at,
          ...ratings
        });
      }
    }

    // Open-ended sheet — combined across run_feedback, session_feedback,
    // and the legacy reviews table. One row per (responder, question)
    // pair so long-form text is the dominant column.
    interface OpenEndedSheetRow { source: string; username: string; runOrSession: string;
                                  questionId: string; text: string; submittedAt: string }
    const openRows: OpenEndedSheetRow[] = [];
    function harvest(source: string, raw: string | null | undefined,
                     username: string | null, runOrSession: string, submittedAt: string): void {
      const parsed = safeParse(raw || '{}') as Record<string, unknown> | null;
      if (!parsed) return;
      for (const [qid, value] of Object.entries(parsed)) {
        if (typeof value !== 'string' || value.trim().length === 0) continue;
        openRows.push({ source, username: username || '', runOrSession, questionId: qid, text: value, submittedAt });
      }
    }
    for (const r of perRunRows) harvest('per-run', r.open_json, r.username, r.run_id, r.submitted_at);
    for (const r of perSessRows) harvest('per-session', r.open_json, r.username, r.session_uuid, r.submitted_at);
    interface ReviewOpenRow { id: number; username: string | null; answers_json: string; created_at: string; analysis_run_id: number | null }
    const reviewRows = db.prepare(`
      SELECT rv.id, u.username, rv.answers_json, rv.created_at, rv.analysis_run_id
      FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
      ORDER BY rv.created_at ASC
    `).all() as ReviewOpenRow[];
    for (const r of reviewRows) harvest('review', r.answers_json, r.username, String(r.analysis_run_id ?? ''), r.created_at);

    if (openRows.length > 0) {
      const sheet = workbook.addWorksheet('Open-ended');
      sheet.columns = [
        { header: 'source',        key: 'source',        width: 14 },
        { header: 'username',      key: 'username',      width: 16 },
        { header: 'runOrSession',  key: 'runOrSession',  width: 36 },
        { header: 'questionId',    key: 'questionId',    width: 12 },
        { header: 'text',          key: 'text',          width: 80 },
        { header: 'submittedAt',   key: 'submittedAt',   width: 22 }
      ];
      for (const r of openRows) sheet.addRow(r);
    }

    if (workbook.worksheets.length === 0) {
      // Empty workbook — give the operator at least one sheet so Excel
      // doesn't reject the file as malformed.
      const empty = workbook.addWorksheet('No data');
      empty.addRow(['No survey responses yet.']);
    }

    const buf = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="neoterritory-questionnaire-b-${stamp}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

function collectKeys(maps: Array<Record<string, unknown> | null>): string[] {
  const seen = new Set<string>();
  for (const m of maps) {
    if (!m) continue;
    for (const k of Object.keys(m)) seen.add(k);
  }
  // Stable sort: section letter (B/C/D/E/F/G) then numeric suffix.
  const order = ['B', 'C', 'D', 'E', 'F', 'G'];
  return [...seen].sort((a, b) => {
    const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0]);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    const an = parseInt(a.replace(/\D+/g, ''), 10) || 0;
    const bn = parseInt(b.replace(/\D+/g, ''), 10) || 0;
    return an - bn;
  });
}

// Full Questionnaire B export (CSV). One row per review submission;
// each row carries the responder, scope (per-run / end-of-session),
// the run id when scoped to a run, and EVERY answered question
// (Likert + open-ended) as separate columns. Columns are derived
// from the union of keys actually answered, so the header reflects
// what was collected in the field.
router.get('/stats/survey-export.csv', (_req: Request, res: Response, next: NextFunction) => {
  try {
    interface Row { id: number; user_id: number | null; username: string | null;
                    scope: string; analysis_run_id: number | null;
                    answers_json: string; created_at: string }
    const rows = db.prepare(`
      SELECT rv.id, rv.user_id, u.username, rv.scope, rv.analysis_run_id,
             rv.answers_json, rv.created_at
      FROM reviews rv
      LEFT JOIN users u ON u.id = rv.user_id
      ORDER BY rv.created_at ASC
    `).all() as Row[];

    // First pass — collect every answer key so the CSV header is the
    // union of question ids present across all reviews. Stable order:
    // reuse the questionnaire's section order when ids match the
    // canonical pattern (e.g. B1, C11, D17, E20, F22), else append.
    const SECTION_ORDER = ['B', 'C', 'D', 'E', 'F', 'G'];
    const seenKeys = new Set<string>();
    const parsed = rows.map(r => {
      const a = (() => { try { return JSON.parse(r.answers_json) as Record<string, unknown>; }
                        catch { return {}; } })();
      Object.keys(a).forEach(k => seenKeys.add(k));
      return { ...r, answers: a };
    });
    const orderedKeys = [...seenKeys].sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a[0]); const bi = SECTION_ORDER.indexOf(b[0]);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      const an = parseInt(a.slice(1), 10) || 0;
      const bn = parseInt(b.slice(1), 10) || 0;
      return an - bn;
    });

    function csvEscape(v: unknown): string {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    const header = ['review_id', 'user_id', 'username', 'scope', 'analysis_run_id', 'created_at', ...orderedKeys];
    const lines: string[] = [header.map(csvEscape).join(',')];
    for (const r of parsed) {
      const cells = [
        r.id, r.user_id ?? '', r.username ?? '', r.scope,
        r.analysis_run_id ?? '', r.created_at,
        ...orderedKeys.map(k => r.answers[k])
      ];
      lines.push(cells.map(csvEscape).join(','));
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="neoterritory-questionnaire-b-${stamp}.csv"`);
    res.send(lines.join('\r\n') + '\r\n');
  } catch (err) { next(err); }
});

router.get('/stats/survey-summary', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT scope, answers_json FROM reviews`).all() as ReviewRow[];

    type BucketMap = Record<string, number[]>;
    const perRun: BucketMap    = {};
    const endSession: BucketMap = {};

    for (const row of rows) {
      const answers = safeParse(row.answers_json) as Record<string, unknown> | null;
      if (!answers) continue;
      const bucket = row.scope === 'per-run' ? perRun : endSession;
      for (const [key, val] of Object.entries(answers)) {
        if (typeof val !== 'number') continue;
        if (!bucket[key]) bucket[key] = [];
        bucket[key]!.push(val);
      }
    }

    function summarize(bucket: BucketMap) {
      const out: Record<string, { avg: number; count: number; distribution: number[] }> = {};
      for (const [key, vals] of Object.entries(bucket)) {
        const count = vals.length;
        const avg   = count ? Number((vals.reduce((s, v) => s + v, 0) / count).toFixed(2)) : 0;
        const dist  = [0, 0, 0, 0, 0];
        for (const v of vals) {
          const idx = Math.max(0, Math.min(4, Math.round(v) - 1));
          dist[idx]!++;
        }
        out[key] = { avg, count, distribution: dist };
      }
      return out;
    }

    res.json({ perRun: summarize(perRun), endOfSession: summarize(endSession) });
  } catch (err) { next(err); }
});

// ─── Complexity data + OLS regression ────────────────────────────────────────

interface ComplexityRunRow { id: number; source_text: string; analysis_json: string }

function olsRegression(points: Array<{ x: number; y: number }>): {
  slope: number; intercept: number; r2: number; n: number; interpretation: string
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0, n, interpretation: 'Too few data points' };
  const xBar = points.reduce((s, p) => s + p.x, 0) / n;
  const yBar = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, sst = 0;
  for (const { x, y } of points) {
    sxy += (x - xBar) * (y - yBar);
    sxx += (x - xBar) ** 2;
    sst += (y - yBar) ** 2;
  }
  if (sxx === 0) return { slope: 0, intercept: yBar, r2: 0, n, interpretation: 'No token variance' };
  const slope     = sxy / sxx;
  const intercept = yBar - slope * xBar;
  let ssr = 0;
  for (const { x, y } of points) {
    ssr += (y - (slope * x + intercept)) ** 2;
  }
  const r2 = sst === 0 ? 0 : Number((1 - ssr / sst).toFixed(4));
  const slopeStr = slope.toFixed(2);
  let interpretation = '';
  if (r2 >= 0.8)       interpretation = `Strong linear O(n) — processing time grows ${slopeStr}ms per token (R²=${r2})`;
  else if (r2 >= 0.5)  interpretation = `Moderate linear trend — ${slopeStr}ms per token (R²=${r2})`;
  else                 interpretation = `Weak correlation — token count is not a reliable predictor (R²=${r2})`;
  return { slope: Number(slope.toFixed(4)), intercept: Number(intercept.toFixed(4)), r2, n, interpretation };
}

// Test-run pass/fail tally derived from the gdb.<phase>.<pass|fail> events
// the runner emits to the logs table. Used by the admin "Unit-test
// accuracy" panel and (with a user filter) by the studio sidebar.
router.get('/stats/test-runs', (_req: Request, res: Response, next: NextFunction) => {
  try {
    interface Row { event_type: string; n: number }
    const rows = db.prepare(
      `SELECT event_type, COUNT(*) AS n
       FROM logs
       WHERE event_type LIKE 'gdb.%'
       GROUP BY event_type`
    ).all() as Row[];
    let passed = 0, failed = 0;
    const phaseMap = new Map<string, { passed: number; failed: number }>();
    for (const r of rows) {
      const m = r.event_type.match(/^gdb\.([^.]+)\.(pass|fail)$/);
      if (!m) continue;
      const [, phase, kind] = m;
      const slot = phaseMap.get(phase) || { passed: 0, failed: 0 };
      if (kind === 'pass') { slot.passed += r.n; passed += r.n; }
      else                 { slot.failed += r.n; failed += r.n; }
      phaseMap.set(phase, slot);
    }
    const total = passed + failed;
    res.json({
      total, passed, failed,
      passRate: total > 0 ? passed / total : 0,
      perPhase: [...phaseMap.entries()].map(([phase, v]) => ({ phase, ...v }))
    });
  } catch (err) { next(err); }
});

router.get('/stats/complexity-data', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT id, source_text, analysis_json FROM analysis_runs`)
      .all() as ComplexityRunRow[];

    type PointData = { x: number; y: number };
    const regressionInput: PointData[] = [];
    const points: Array<{
      runId: number; tokens: number; loc: number; patternCount: number; totalTargets: number; totalMs: number
    }> = [];

    // Token count is a better predictor of analyzer cost than line count:
    // a single 200-character chained call costs more than 20 short lines.
    // We use a coarse C++-friendly tokenizer (identifiers, numbers, and any
    // single non-whitespace punctuation char each count as one token).
    function countTokens(text: string): number {
      const m = text.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s\w]/g);
      return m ? m.length : 0;
    }

    for (const row of rows) {
      const a = safeParse(row.analysis_json) as {
        detectedPatterns?: Array<{ documentationTargets?: unknown[] }>;
        stageMetrics?:     Array<{ milliseconds?: number }>;
        tokenCount?:       number;
      } | null;
      if (!a) continue;
      const src          = row.source_text || '';
      // Prefer a microservice-supplied token count when present; fall back
      // to local tokenization so older runs still chart cleanly.
      const tokens       = typeof a.tokenCount === 'number' && a.tokenCount > 0
                           ? a.tokenCount
                           : countTokens(src);
      const loc          = src.split('\n').length;
      const patterns     = a.detectedPatterns || [];
      const patternCount = patterns.length;
      const totalTargets = patterns.reduce((s, p) => s + (p.documentationTargets?.length || 0), 0);
      const totalMs      = (a.stageMetrics || []).reduce((s, m) => s + (m.milliseconds || 0), 0);
      if (totalMs === 0) continue;
      points.push({ runId: row.id, tokens, loc, patternCount, totalTargets, totalMs });
      regressionInput.push({ x: tokens, y: totalMs });
    }

    res.json({ points, regression: olsRegression(regressionInput) });
  } catch (err) { next(err); }
});

// ─── F1 metrics ──────────────────────────────────────────────────────────────

interface ManualDecisionRow {
  analysis_run_id: number;
  line_number:     number;
  chosen_kind:     string;
  chosen_pattern:  string | null;
}

interface DetectedForLine { patternId?: string; patternName?: string }

router.get('/stats/f1-metrics', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const decisions = db.prepare(`SELECT run_id AS analysis_run_id, line AS line_number, chosen_kind, chosen_pattern
      FROM manual_pattern_decisions`).all() as ManualDecisionRow[];

    const runs = db.prepare(`SELECT id, analysis_json FROM analysis_runs`).all() as Array<{
      id: number; analysis_json: string
    }>;

    const runAnalysisMap = new Map<number, {
      detectedPatterns: Array<{ patternName?: string; patternId?: string; documentationTargets?: Array<{ line?: number }> }>
    }>();
    for (const r of runs) {
      const a = safeParse(r.analysis_json) as { detectedPatterns?: DetectedForLine[] } | null;
      if (a && a.detectedPatterns) runAnalysisMap.set(r.id, a as never);
    }

    const perPattern = new Map<string, { tp: number; fp: number; fn: number }>();
    let totalTp = 0, totalFp = 0, totalFn = 0;

    function getOrAdd(key: string) {
      if (!perPattern.has(key)) perPattern.set(key, { tp: 0, fp: 0, fn: 0 });
      return perPattern.get(key)!;
    }

    for (const dec of decisions) {
      const analysis = runAnalysisMap.get(dec.analysis_run_id);
      if (!analysis) continue;
      const detectedAtLine = (analysis.detectedPatterns || []).filter(p =>
        (p.documentationTargets || []).some((t: { line?: number }) => t.line === dec.line_number)
      );
      const detectedKeys = detectedAtLine.map(p => p.patternName || p.patternId || 'unknown');

      if (dec.chosen_kind === 'none') {
        for (const k of detectedKeys) { getOrAdd(k).fp++; totalFp++; }
      } else if (dec.chosen_kind === 'pattern' && dec.chosen_pattern) {
        const correct = dec.chosen_pattern;
        if (detectedKeys.includes(correct)) {
          getOrAdd(correct).tp++; totalTp++;
        } else {
          getOrAdd(correct).fn++; totalFn++;
          for (const k of detectedKeys.filter(k => k !== correct)) { getOrAdd(k).fp++; totalFp++; }
        }
      }
    }

    function f1(tp: number, fp: number, fn: number) {
      const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
      const recall    = tp + fn === 0 ? 0 : tp / (tp + fn);
      const f         = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
      return { precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)), f1: Number(f.toFixed(4)), tp, fp, fn };
    }

    const overall = f1(totalTp, totalFp, totalFn);
    const perPatternOut = [...perPattern.entries()].map(([pattern, s]) => ({
      pattern, ...f1(s.tp, s.fp, s.fn)
    })).sort((a, b) => b.f1 - a.f1);

    // Pull avg accuracy from per-run reviews
    const accuracyRows = db.prepare(`SELECT answers_json FROM reviews WHERE scope = 'per-run'`)
      .all() as Array<{ answers_json: string }>;
    let accSum = 0, accCount = 0;
    for (const r of accuracyRows) {
      const a = safeParse(r.answers_json) as Record<string, unknown> | null;
      if (a && typeof a['accuracy'] === 'number') { accSum += a['accuracy'] as number; accCount++; }
    }
    const userAccuracyAvg = accCount ? Number((accSum / accCount).toFixed(2)) : null;

    // Pearson correlation between per-run F1 and per-run Likert accuracy
    // Keyed by analysis_run_id
    const runF1Map = new Map<number, number>();
    for (const dec of decisions) {
      const analysis = runAnalysisMap.get(dec.analysis_run_id);
      if (!analysis) continue;
      const detectedAtLine = (analysis.detectedPatterns || []).filter(p =>
        (p.documentationTargets || []).some((t: { line?: number }) => t.line === dec.line_number)
      );
      const detectedKeys = detectedAtLine.map(p => p.patternName || p.patternId || 'unknown');
      let tp = 0, fp = 0;
      if (dec.chosen_kind === 'none') fp += detectedKeys.length;
      else if (dec.chosen_kind === 'pattern' && dec.chosen_pattern) {
        if (detectedKeys.includes(dec.chosen_pattern)) tp++;
        else fp += detectedKeys.length;
      }
      const prev = runF1Map.get(dec.analysis_run_id) || 0;
      runF1Map.set(dec.analysis_run_id, prev + tp - fp);
    }

    const reviewRunRows = db.prepare(`SELECT analysis_run_id, answers_json FROM reviews
      WHERE scope = 'per-run' AND analysis_run_id IS NOT NULL`).all() as Array<{
      analysis_run_id: number; answers_json: string
    }>;
    const corPairs: Array<{ x: number; y: number }> = [];
    for (const r of reviewRunRows) {
      const a = safeParse(r.answers_json) as Record<string, unknown> | null;
      if (!a || typeof a['accuracy'] !== 'number') continue;
      if (!runF1Map.has(r.analysis_run_id)) continue;
      corPairs.push({ x: a['accuracy'] as number, y: runF1Map.get(r.analysis_run_id)! });
    }

    let likertF1Correlation: number | null = null;
    if (corPairs.length >= 3) {
      const n = corPairs.length;
      const xBar = corPairs.reduce((s, p) => s + p.x, 0) / n;
      const yBar = corPairs.reduce((s, p) => s + p.y, 0) / n;
      let sxy = 0, sxx = 0, syy = 0;
      for (const { x, y } of corPairs) {
        sxy += (x - xBar) * (y - yBar);
        sxx += (x - xBar) ** 2;
        syy += (y - yBar) ** 2;
      }
      likertF1Correlation = sxx && syy ? Number((sxy / Math.sqrt(sxx * syy)).toFixed(4)) : null;
    }

    res.json({
      overall,
      perPattern: perPatternOut,
      userAccuracyAvg,
      likertF1Correlation,
      note: 'F1 from manual decisions; Likert is self-reported accuracy'
    });
  } catch (err) { next(err); }
});

export default router;
