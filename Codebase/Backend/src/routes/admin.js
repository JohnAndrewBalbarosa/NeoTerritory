const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

const ALPHA_THRESHOLDS_PATH = path.join(
  __dirname, '..', '..', '..', '..', 'test', 'alpha', 'system', 'thresholds.json'
);

router.use(jwtAuth, requireAdmin);

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

router.get('/users', (req, res, next) => {
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

router.get('/users/:id/runs', (req, res, next) => {
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

router.get('/runs/:id', (req, res, next) => {
  try {
    const run = db.prepare(`
      SELECT r.*, u.username
      FROM analysis_runs r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `).get(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
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

router.get('/stats/overview', (req, res, next) => {
  try {
    const totalUsers = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
    const totalRuns = db.prepare(`SELECT COUNT(*) AS c FROM analysis_runs`).get().c;
    const runsToday = db.prepare(
      `SELECT COUNT(*) AS c FROM analysis_runs WHERE date(created_at) = date('now')`
    ).get().c;
    const totalReviews = db.prepare(`SELECT COUNT(*) AS c FROM reviews`).get().c;
    const avgFindings = db.prepare(
      `SELECT AVG(findings_count) AS a FROM analysis_runs`
    ).get().a;
    res.json({
      totalUsers,
      totalRuns,
      runsToday,
      totalReviews,
      avgFindings: avgFindings ? Number(avgFindings.toFixed(2)) : 0
    });
  } catch (err) { next(err); }
});

router.get('/stats/runs-per-day', (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
    const rows = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count
      FROM analysis_runs
      WHERE date(created_at) >= date('now', ?)
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(`-${days - 1} days`);
    const map = new Map(rows.map(r => [r.date, r.count]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: map.get(key) || 0 });
    }
    res.json({ series });
  } catch (err) { next(err); }
});

router.get('/stats/pattern-frequency', (req, res, next) => {
  try {
    const rows = db.prepare(`SELECT analysis_json FROM analysis_runs`).all();
    const counts = new Map();
    for (const row of rows) {
      const a = safeParse(row.analysis_json);
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

router.get('/stats/score-distribution', (req, res, next) => {
  try {
    const rows = db.prepare(`SELECT findings_count FROM analysis_runs`).all();
    const buckets = { '0': 0, '1-2': 0, '3-5': 0, '6-10': 0, '11+': 0 };
    for (const r of rows) {
      const n = r.findings_count || 0;
      if (n === 0) buckets['0']++;
      else if (n <= 2) buckets['1-2']++;
      else if (n <= 5) buckets['3-5']++;
      else if (n <= 10) buckets['6-10']++;
      else buckets['11+']++;
    }
    res.json({
      buckets: Object.entries(buckets).map(([range, count]) => ({ range, count }))
    });
  } catch (err) { next(err); }
});

router.get('/stats/per-user-activity', (req, res, next) => {
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
    `).all();
    res.json({
      series: rows.map(r => ({
        username: r.username,
        runs: r.runs,
        avgFindings: r.avgFindings ? Number(r.avgFindings.toFixed(2)) : 0
      }))
    });
  } catch (err) { next(err); }
});

router.get('/logs', (req, res, next) => {
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

router.get('/reviews', (req, res, next) => {
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
    `).all(limit);
    res.json({
      reviews: rows.map(r => ({
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

router.get('/alpha/thresholds', (req, res, next) => {
  try {
    if (!fs.existsSync(ALPHA_THRESHOLDS_PATH)) {
      return res.status(404).json({ error: 'thresholds.json not found' });
    }
    const raw = fs.readFileSync(ALPHA_THRESHOLDS_PATH, 'utf8');
    const data = JSON.parse(raw);
    res.json({ path: ALPHA_THRESHOLDS_PATH, thresholds: data });
  } catch (err) { next(err); }
});

module.exports = router;
