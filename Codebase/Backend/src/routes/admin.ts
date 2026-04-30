import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { requireAdmin } from '../middleware/requireAdmin';

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
      SELECT u.id, u.username, u.email, u.role, u.created_at,
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
    const totalUsers = (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as CountRow).c;
    const totalRuns = (db.prepare(`SELECT COUNT(*) AS c FROM analysis_runs`).get() as CountRow).c;
    const runsToday = (db.prepare(
      `SELECT COUNT(*) AS c FROM analysis_runs WHERE date(created_at) = date('now')`
    ).get() as CountRow).c;
    const totalReviews = (db.prepare(`SELECT COUNT(*) AS c FROM reviews`).get() as CountRow).c;
    const avgFindings = (db.prepare(
      `SELECT AVG(findings_count) AS a FROM analysis_runs`
    ).get() as AvgRow).a;
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
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
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
    const counts = new Map<string, number>();
    for (const row of rows) {
      const a = safeParse(row.analysis_json) as { detectedPatterns?: Array<{ patternName?: string; patternId?: string }> } | null;
      const patterns = (a && a.detectedPatterns) || [];
      for (const p of patterns) {
        const key = p.patternName || p.patternId || 'unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const series = [...counts.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
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
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const rows = userId
      ? db.prepare(`
          SELECT l.*, u.username FROM logs l
          LEFT JOIN users u ON u.id = l.user_id
          WHERE l.user_id = ?
          ORDER BY l.id DESC LIMIT ?
        `).all(userId, limit)
      : db.prepare(`
          SELECT l.*, u.username FROM logs l
          LEFT JOIN users u ON u.id = l.user_id
          ORDER BY l.id DESC LIMIT ?
        `).all(limit);
    res.json({ logs: rows });
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

export default router;
