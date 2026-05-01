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

// ─── Survey summary ──────────────────────────────────────────────────────────

interface ReviewRow { scope: string; answers_json: string }

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
  if (sxx === 0) return { slope: 0, intercept: yBar, r2: 0, n, interpretation: 'No LOC variance' };
  const slope     = sxy / sxx;
  const intercept = yBar - slope * xBar;
  let ssr = 0;
  for (const { x, y } of points) {
    ssr += (y - (slope * x + intercept)) ** 2;
  }
  const r2 = sst === 0 ? 0 : Number((1 - ssr / sst).toFixed(4));
  const slopeStr = slope.toFixed(2);
  let interpretation = '';
  if (r2 >= 0.8)       interpretation = `Strong linear O(n) — processing time grows ${slopeStr}ms per LOC (R²=${r2})`;
  else if (r2 >= 0.5)  interpretation = `Moderate linear trend — ${slopeStr}ms per LOC (R²=${r2})`;
  else                 interpretation = `Weak correlation — LOC is not a reliable predictor (R²=${r2})`;
  return { slope: Number(slope.toFixed(4)), intercept: Number(intercept.toFixed(4)), r2, n, interpretation };
}

router.get('/stats/complexity-data', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT id, source_text, analysis_json FROM analysis_runs`)
      .all() as ComplexityRunRow[];

    type PointData = { x: number; y: number };
    const regressionInput: PointData[] = [];
    const points: Array<{
      runId: number; loc: number; patternCount: number; totalTargets: number; totalMs: number
    }> = [];

    for (const row of rows) {
      const a = safeParse(row.analysis_json) as {
        detectedPatterns?: Array<{ documentationTargets?: unknown[] }>;
        stageMetrics?:     Array<{ milliseconds?: number }>;
      } | null;
      if (!a) continue;
      const loc          = (row.source_text || '').split('\n').length;
      const patterns     = a.detectedPatterns || [];
      const patternCount = patterns.length;
      const totalTargets = patterns.reduce((s, p) => s + (p.documentationTargets?.length || 0), 0);
      const totalMs      = (a.stageMetrics || []).reduce((s, m) => s + (m.milliseconds || 0), 0);
      if (totalMs === 0) continue;
      points.push({ runId: row.id, loc, patternCount, totalTargets, totalMs });
      regressionInput.push({ x: loc, y: totalMs });
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
    const decisions = db.prepare(`SELECT analysis_run_id, line_number, chosen_kind, chosen_pattern
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
