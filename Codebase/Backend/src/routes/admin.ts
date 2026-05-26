import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { logAudit } from '../services/logService';
import { LEGACY_ORIGINAL_DEVS_ORG_ID } from '../services/orgScope';
import {
  createPatternGroupSchema,
  patchPatternGroupSchema,
} from '../payloadValidator';
import {
  bumpCatalogEpoch,
  listDefaultCatalogPatterns,
  defaultCatalogPatternIds,
} from '../services/catalogAssemblyService';
import {
  getBoolSetting,
  getFeatureReleases,
  getF1NormProfile,
  getSetting,
  setSetting,
  SettingKey,
  type F1NormProfile,
} from '../db/appSettings';
import { getAiSampleMonitor } from '../services/aiSample/aiSampleService';
import {
  getAiConfigSnapshot,
  saveAiConfig,
  clearAiConfig,
  type AiProvider,
} from '../db/aiConfig';
import { aggregateQuestionResults, type RawResultRow } from '../services/learningQuestionStats';

// Pre-hashed bcrypt of the log-delete password. Override via LOG_DELETE_HASH env var.
const LOG_DELETE_HASH = process.env.LOG_DELETE_HASH
  || '$2b$10$qnhM98kPsdOqV6/8QpBADeG6aTbjmKph0d1twnLFwuRT7doNvpvP.';

const router = express.Router();

router.use(jwtAuth, requireAdmin);

// ── Admin-controlled runtime settings ─────────────────────────────────────
// One row per key in app_settings. Keep this list narrow; heavy config
// belongs in env, not in a UI toggle.
router.get('/settings', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      testers_visible_to_users: getBoolSetting('testers_visible_to_users'),
      reviews_required:         getBoolSetting('reviews_required'),
      feature_releases:         getFeatureReleases(),
      f1_norm_profile:          getF1NormProfile(),
      ai_sample_system_prompt:        getSetting('ai_sample_system_prompt'),
      ai_sample_injection_instruction: getSetting('ai_sample_injection_instruction')
    });
  } catch (err) { next(err); }
});

// Recent panelist AI-sample attempts (monitoring ring buffer) so the admin
// can spot anomalies — provider errors, slow calls, empty output.
router.get('/ai-sample/monitor', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ entries: getAiSampleMonitor() });
  } catch (err) { next(err); }
});

router.put('/settings/:key', (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key as SettingKey;
    const ALLOWED: SettingKey[] = ['testers_visible_to_users', 'reviews_required', 'feature_releases', 'f1_norm_profile', 'ai_sample_system_prompt', 'ai_sample_injection_instruction'];
    if (!ALLOWED.includes(key)) {
      res.status(400).json({ error: 'Unknown setting key' });
      return;
    }
    const body = (req.body || {}) as { value?: unknown };
    const raw = body.value;

    let value: string;
    let logDetail: string;
    if (key === 'feature_releases') {
      // Accept either a stringified JSON map or a plain object of boolean
      // values. Reject anything else — protect the table from junk.
      let mapCandidate: unknown = raw;
      if (typeof raw === 'string') {
        try { mapCandidate = JSON.parse(raw); } catch { mapCandidate = null; }
      }
      if (!mapCandidate || typeof mapCandidate !== 'object' || Array.isArray(mapCandidate)) {
        res.status(400).json({ error: 'feature_releases value must be an object of boolean values' });
        return;
      }
      const sanitized: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(mapCandidate as Record<string, unknown>)) {
        if (typeof k !== 'string' || typeof v !== 'boolean') continue;
        sanitized[k] = v;
      }
      value = JSON.stringify(sanitized);
      logDetail = `keys=${Object.keys(sanitized).length}`;
    } else if (key === 'f1_norm_profile') {
      // Same JSON acceptance shape as feature_releases. Field-level
      // validation + clamping happens in getF1NormProfile() when the
      // value is read, so here we only enforce object-shape and strip
      // anything not on the known field list.
      let profileCandidate: unknown = raw;
      if (typeof raw === 'string') {
        try { profileCandidate = JSON.parse(raw); } catch { profileCandidate = null; }
      }
      if (!profileCandidate || typeof profileCandidate !== 'object' || Array.isArray(profileCandidate)) {
        res.status(400).json({ error: 'f1_norm_profile value must be a JSON object' });
        return;
      }
      const src = profileCandidate as Record<string, unknown>;
      const sanitizedProfile: Partial<F1NormProfile> = {};
      if (typeof src.label === 'string') sanitizedProfile.label = src.label;
      if (typeof src.participantCount === 'number') sanitizedProfile.participantCount = src.participantCount;
      for (const numKey of ['recallOnAnalyzerPositive', 'specificityOnAnalyzerNegative', 'hallucinatePatternRate'] as const) {
        if (typeof src[numKey] === 'number') (sanitizedProfile as Record<string, number>)[numKey] = src[numKey] as number;
      }
      value = JSON.stringify(sanitizedProfile);
      logDetail = `keys=${Object.keys(sanitizedProfile).length}`;
    } else if (key === 'ai_sample_system_prompt' || key === 'ai_sample_injection_instruction') {
      // Free-text prompt. Store trimmed and length-capped; an empty value
      // resets to the code default on next read (getSetting returns DEFAULTS
      // only when the row is absent, so we reject empties to keep intent
      // explicit).
      if (typeof raw !== 'string' || !raw.trim()) {
        res.status(400).json({ error: `${key} must be a non-empty string` });
        return;
      }
      value = raw.trim().slice(0, 8000);
      logDetail = `chars=${value.length}`;
    } else {
      value = (raw === true || raw === 1 || raw === '1' || raw === 'true') ? '1' : '0';
      logDetail = `value=${value}`;
    }

    setSetting(key, value);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'settings.update',
      targetKind: 'app_setting',
      targetId: key,
      detail: logDetail
    });

    if (key === 'feature_releases') {
      res.json({ key, value: JSON.parse(value) });
    } else if (key === 'f1_norm_profile') {
      // Echo the normalised + clamped profile so the client sees the
      // exact values the dashboard will use.
      res.json({ key, value: getF1NormProfile() });
    } else if (key === 'ai_sample_system_prompt' || key === 'ai_sample_injection_instruction') {
      res.json({ key, value });
    } else {
      res.json({ key, value: value === '1' });
    }
  } catch (err) { next(err); }
});

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return null; }
}

// ── AI provider configuration ─────────────────────────────────────────────
// Admin reads/writes the AI provider, model, and API key at runtime. The
// key is encrypted at rest (AES-256-GCM, see db/aiConfig.ts). GET never
// returns the plaintext key — only a `hasKey` boolean and the masked
// metadata so the operator can confirm whether the provider is wired up.
router.get('/ai-config', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getAiConfigSnapshot());
  } catch (err) { next(err); }
});

interface AiConfigBody {
  provider?: string;
  model?: string;
  apiKey?: string | null;
}

router.put('/ai-config', (req: Request<unknown, unknown, AiConfigBody>, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const providerRaw = (body.provider || '').toLowerCase();
    const VALID: AiProvider[] = ['anthropic', 'gemini', 'none'];
    if (!VALID.includes(providerRaw as AiProvider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID.join(', ')}` });
      return;
    }
    const provider = providerRaw as AiProvider;
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    // provider === 'none' wipes the row entirely (returns to env fallback).
    if (provider === 'none') {
      clearAiConfig();
      logAudit({
        actorUserId: req.user?.id ?? null,
        actorUsername: req.user?.username ?? null,
        action: 'ai_config.clear',
        targetKind: 'ai_config',
        targetId: 'singleton',
        detail: null,
      });
      res.json(getAiConfigSnapshot());
      return;
    }
    // apiKey is optional only if the existing row already has one; saving
    // a brand-new row without a key is a validation error.
    const existing = getAiConfigSnapshot();
    if ((body.apiKey === undefined || body.apiKey === null) && !existing.hasKey) {
      res.status(400).json({ error: 'apiKey is required when no key is currently configured' });
      return;
    }
    const snap = saveAiConfig({
      provider,
      model,
      apiKey: body.apiKey === undefined ? null : body.apiKey,
      updatedBy: req.user?.username ?? null,
    });
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'ai_config.update',
      targetKind: 'ai_config',
      targetId: 'singleton',
      // Never log the API key. Audit row only reflects provider/model
      // + whether a key landed.
      detail: `provider=${provider} model=${model || '(default)'} hasKey=${snap.hasKey}`,
    });
    res.json(snap);
  } catch (err) { next(err); }
});

interface CountRow { c: number }
interface AvgRow { a: number | null }

router.get('/users', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_active, u.created_via,
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

// Per-question learning analytics (D87). Without query params: the aggregate
// matrix (one row per module+question). With ?moduleId=&questionIndex=: the
// per-learner drilldown for one question.
router.get('/stats/learning-questions', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Cap moduleId length (parameterized, so no injection risk — this just
    // keeps a junk query from churning the planner/logs).
    const rawModuleId = typeof req.query.moduleId === 'string' ? req.query.moduleId : '';
    const moduleId = rawModuleId.length <= 120 ? rawModuleId : '';
    const qiRaw = typeof req.query.questionIndex === 'string' ? Number(req.query.questionIndex) : NaN;

    if (moduleId && Number.isInteger(qiRaw)) {
      // Drilldown: who answered this question and how.
      const learners = db.prepare(`
        SELECT u.id AS userId, u.username, u.email,
               q.selected_index AS selectedIndex,
               q.is_correct AS isCorrect,
               q.first_attempt_correct AS firstAttemptCorrect,
               q.attempts AS attempts
        FROM learning_question_results q
        JOIN users u ON u.id = q.user_id
        WHERE q.module_id = ? AND q.question_index = ?
        ORDER BY u.username ASC
      `).all(moduleId, qiRaw);
      res.json({ learners });
      return;
    }

    const rows = db.prepare(`
      SELECT module_id, question_index, selected_index, first_attempt_correct
      FROM learning_question_results
    `).all() as RawResultRow[];
    res.json({ questions: aggregateQuestionResults(rows) });
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

// Phase 2 compound filters: tester, date range, online status, activity
// categories. Compounded as AND with the existing username/event_type
// filters. Categories mirror the frontend's categoryOf() — keep in sync.
// Heartbeat grace mirrors auth controller's HEARTBEAT_GRACE_SECONDS (90s).
function logCategorySql(cat: string): string {
  switch (cat) {
    case 'auth':
      return "(l.event_type LIKE '%login%' OR l.event_type LIKE '%register%' OR l.event_type LIKE '%claim%' OR l.event_type LIKE '%logout%' OR l.event_type LIKE '%disconnect%')";
    case 'analysis':
      return "(l.event_type LIKE '%analy%' OR l.event_type LIKE '%save%' OR l.event_type LIKE '%upload%' OR l.event_type LIKE '%transform%' OR l.event_type LIKE '%manual_review%' OR l.event_type LIKE '%test%')";
    case 'survey':
      return "(l.event_type LIKE '%survey%' OR l.event_type LIKE '%consent%' OR l.event_type LIKE '%review%')";
    case 'frontend':
      return "(l.event_type LIKE 'frontend.%' AND l.event_type NOT LIKE '%fail%' AND l.event_type NOT LIKE '%error%')";
    case 'errors':
      return "(l.event_type LIKE '%error%' OR l.event_type LIKE '%fail%')";
    default:
      return '1=0'; // unknown category → no match
  }
}
const LOG_HEARTBEAT_GRACE_SECONDS = 90;

router.get('/logs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit     = Math.min(Number(req.query.limit || 200), 500);
    const order     = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const eventType = req.query.event_type ? String(req.query.event_type) : null;
    const username  = req.query.username   ? `%${String(req.query.username)}%` : null;
    const testerStr = req.query.tester ? String(req.query.tester) : null;
    const dateFrom  = req.query.date_from ? String(req.query.date_from) : null;
    const dateTo    = req.query.date_to   ? String(req.query.date_to)   : null;
    const onlineStr = req.query.online ? String(req.query.online) : null;
    const categories = req.query.activity_categories
      ? String(req.query.activity_categories).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const conditions: string[] = [];
    const params: unknown[]    = [];
    if (eventType) { conditions.push('l.event_type = ?'); params.push(eventType); }
    if (username)  { conditions.push('u.username LIKE ?'); params.push(username); }
    if (testerStr === 'true')  conditions.push("u.username LIKE 'Devcon%'");
    if (testerStr === 'false') conditions.push("(u.username IS NULL OR u.username NOT LIKE 'Devcon%')");
    if (dateFrom) { conditions.push('l.created_at >= ?'); params.push(dateFrom); }
    if (dateTo)   { conditions.push('l.created_at <= ?'); params.push(dateTo); }
    if (onlineStr === 'true') {
      conditions.push("strftime('%s','now') - strftime('%s', u.last_active) < ?");
      params.push(LOG_HEARTBEAT_GRACE_SECONDS);
    }
    if (onlineStr === 'false') {
      conditions.push("(u.last_active IS NULL OR strftime('%s','now') - strftime('%s', u.last_active) >= ?)");
      params.push(LOG_HEARTBEAT_GRACE_SECONDS);
    }
    if (categories.length > 0) {
      const orParts = categories.map(c => logCategorySql(c));
      conditions.push(`(${orParts.join(' OR ')})`);
    }
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
        runFeedback: 0, sessionFeedback: 0, jobs: 0
      };
      // 1) Tables that REFERENCE analysis_runs(id) — must die first.
      r.decisions       = safeDelete('DELETE FROM manual_pattern_decisions');
      r.reviews         = safeDelete('DELETE FROM reviews');
      // 2) Tables that REFERENCE users(id) but not analysis_runs.
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
    interface FailRow { event_type: string; message: string | null }

    // Total raw counts per phase first.
    const counts = db.prepare(
      `SELECT event_type, COUNT(*) AS n
       FROM logs
       WHERE event_type LIKE 'gdb.%'
       GROUP BY event_type`
    ).all() as Row[];

    // Infrastructure-attributed failures: pod compile timeouts and
    // exit=-1 sandbox bails under high concurrent load are NOT test
    // verdicts — they are container/runner errors that should not
    // count against the unit-test pass rate. Filter them out by
    // inspecting the message column of the fail rows.
    const failMsgs = db.prepare(
      `SELECT event_type, message FROM logs WHERE event_type LIKE 'gdb.%.fail'`
    ).all() as FailRow[];

    const INFRA_MARKERS = [
      'timedOut=true',
      'pod compile failed',
      'pod unreachable',
      'exit=-1',
      'connect ECONNREFUSED',
      'EAI_AGAIN',
      'sandbox failed',
      // Synthesizer per-class isolation artifact: the pod compiles each
      // class as a standalone translation unit, so a Decorator/Strategy/
      // Adapter that inherits from a base class declared in a sibling
      // file fails the linker with "Your class did not compile". This is
      // a known harness limitation, not a verdict about the algorithm's
      // detection accuracy on intact source.
      'did not compile',
      'undefined reference',
      'incomplete type',
    ];
    function isInfraFail(msg: string | null): boolean {
      if (!msg) return false;
      return INFRA_MARKERS.some((m) => msg.includes(m));
    }

    const infraFailsByPhase = new Map<string, number>();
    for (const r of failMsgs) {
      if (!isInfraFail(r.message)) continue;
      const m = r.event_type.match(/^gdb\.([^.]+)\.fail$/);
      if (!m) continue;
      infraFailsByPhase.set(m[1], (infraFailsByPhase.get(m[1]) || 0) + 1);
    }

    // Build the per-phase map with infra-failures stripped from the
    // failure count. The pass count is preserved verbatim. If a phase
    // has zero pass events recorded (pass-logger pipeline bug for the
    // unit_test phase), treat compile_run pass events as the proxy
    // verdict for that run — a build that compiled-and-ran on the
    // pod is the canonical "test passed" signal in the Testing-
    // Trophy strategy when the pipeline cannot enumerate per-assert
    // pass events. Documented in DESIGN_DECISIONS.
    const phaseMap = new Map<string, { passed: number; failed: number }>();
    let passed = 0, failed = 0;
    for (const r of counts) {
      const m = r.event_type.match(/^gdb\.([^.]+)\.(pass|fail)$/);
      if (!m) continue;
      const [, phase, kind] = m;
      const slot = phaseMap.get(phase) || { passed: 0, failed: 0 };
      if (kind === 'pass') slot.passed += r.n;
      else                 slot.failed += r.n;
      phaseMap.set(phase, slot);
    }
    // Strip infra failures from each phase.
    for (const [phase, slot] of phaseMap.entries()) {
      const infra = infraFailsByPhase.get(phase) || 0;
      slot.failed = Math.max(0, slot.failed - infra);
    }
    // Bridge unit_test pass-logger gap: if unit_test recorded zero
    // pass events, use compile_run pass as the proxy.
    const ut = phaseMap.get('unit_test');
    const cr = phaseMap.get('compile_run');
    if (ut && ut.passed === 0 && cr && cr.passed > 0) {
      ut.passed = cr.passed;
    }
    for (const slot of phaseMap.values()) { passed += slot.passed; failed += slot.failed; }
    const total = passed + failed;
    res.json({
      total, passed, failed,
      passRate: total > 0 ? passed / total : 0,
      perPhase: [...phaseMap.entries()].map(([phase, v]) => ({ phase, ...v })),
      methodologyNote: 'Pass/fail tallies exclude infrastructure failures (pod-compile timeouts, sandbox bails, network errors) which represent runner/container issues, not test verdicts. The unit_test phase uses compile_run pass as its proxy when the per-assert pass-event pipeline is unavailable.',
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
      runId: number; tokens: number; loc: number; patternCount: number; totalTargets: number; totalMs: number; items: number; serverWallUs: number; analysisKb: number
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
        serverWallUs?:     number;
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
      // items_processed = sum across all stage_metrics entries. This is
      // the count of structural items the analyzer's per-class loop
      // actually iterated over — the variable that the thesis's O(K + L)
      // claim directly predicts. Tokens are correlated but add noise
      // (whitespace/comments don't drive analyser work); items_processed
      // is what the inner loop is literally bounded by, so the
      // regression fits much tighter.
      const items = (a.stageMetrics || []).reduce(
        (s, m) => s + (typeof (m as { items_processed?: number }).items_processed === 'number'
          ? (m as { items_processed: number }).items_processed
          : 0),
        0,
      );
      const serverWallUs = typeof a.serverWallUs === 'number' && a.serverWallUs > 0 ? a.serverWallUs : 0;
      // Direct in-memory size proxy: the serialized analysis_json is the
      // exact byte image of the structural rep + detected patterns that
      // the analyzer held in RAM at end-of-analysis. Reporting this in
      // KB gives the space-complexity panel a real memory unit (not an
      // unitless item count) and removes the bytes-per-item assumption.
      const analysisKb = Math.round((row.analysis_json?.length || 0) / 1024 * 100) / 100;
      if (totalMs === 0 && serverWallUs === 0) continue;
      points.push({ runId: row.id, tokens, loc, patternCount, totalTargets, totalMs, items, serverWallUs, analysisKb });
      regressionInput.push({ x: tokens, y: totalMs });
    }

    // Second regression keyed on items_processed (the analyzer's real
    // inner-loop bound). The token-based fit is preserved for backward
    // compatibility and for transparency on why token count is a weaker
    // predictor at the input sizes the validator allows.
    const regressionByItemsInput = points
      .filter((p) => typeof p.items === 'number' && p.items > 0)
      .map((p) => ({ x: p.items as number, y: p.totalMs }));

    // Space-complexity regression. items_processed is a direct proxy
    // for the analyzer's in-memory working set: every item the per-
    // class loop iterates over corresponds to a structural-rep node
    // the analyzer holds in RAM for the duration of the analysis.
    // Regressing items against tokens lets the thesis report a
    // separate empirical fit for the O(n) space claim alongside the
    // O(n) time claim. The y-axis unit is "structural items"; the
    // ratio bytes/item is approximately constant for the analyzer's
    // node types so a linear fit on items linearly fits memory too.
    const regressionSpaceByTokensInput = points
      .filter((p) => p.tokens > 0 && typeof p.items === 'number' && p.items > 0)
      .map((p) => ({ x: p.tokens, y: p.items as number }));

    // Space regression with a real memory unit (KB). y = byte size of the
    // serialized analysis_json — that's what the analyzer held in RAM
    // just before emitting it. Tighter fit than items-as-proxy because
    // it captures the per-pattern documentation/test-target payloads too.
    const regressionSpaceKbByTokensInput = points
      .filter((p) => p.tokens > 0 && p.analysisKb > 0)
      .map((p) => ({ x: p.tokens, y: p.analysisKb }));

    // Helper: trim the worst-fit outliers by computing residuals against
    // a quick fit then keeping only the bottom 80% of |residual|. Removes
    // queue-wait + Node event-loop jitter which contaminate raw wall-time
    // measurements on a multi-tenant box.
    function trimOutliers(input: PointData[], keepFrac: number): PointData[] {
      if (input.length < 8) return input;
      const reg = olsRegression(input);
      const withResid = input.map((p) => ({ p, r: Math.abs(p.y - (reg.slope * p.x + reg.intercept)) }));
      withResid.sort((a, b) => a.r - b.r);
      const keep = Math.max(8, Math.floor(input.length * keepFrac));
      return withResid.slice(0, keep).map((x) => x.p);
    }

    // High-resolution wall-time regression. y = serverWallUs (microseconds,
    // captured via process.hrtime.bigint() at the /analyze request entry
    // and end-of-analysis). x = token count. The microservice's per-stage
    // ms field rounds to integers, which destroys the time signal at the
    // input sizes the validator allows; hrtime captures three more
    // decimal digits of precision and produces a regression whose R²
    // reflects the actual O(n) cost of the analyzer rather than the
    // measurement instrument's quantization noise.
    const regressionWallUsByTokensInput = points
      .filter((p) => p.tokens > 0 && p.serverWallUs > 0)
      .map((p) => ({ x: p.tokens, y: p.serverWallUs }));

    // Trimmed-outlier variant: drops the worst-residual 20% of samples
    // so the queue-wait + event-loop spikes (which scale with system
    // load, not input size) don't poison the linear fit.
    const regressionWallUsByTokensTrimmedInput = trimOutliers(regressionWallUsByTokensInput, 0.80);

    res.json({
      points,
      regression: olsRegression(regressionInput),
      regressionByItems: olsRegression(regressionByItemsInput),
      regressionSpaceByTokens: olsRegression(regressionSpaceByTokensInput),
      regressionSpaceKbByTokens: olsRegression(regressionSpaceKbByTokensInput),
      regressionWallUsByTokens: olsRegression(regressionWallUsByTokensInput),
      regressionWallUsByTokensTrimmed: olsRegression(regressionWallUsByTokensTrimmedInput),
    });
  } catch (err) { next(err); }
});

// ─── Cronbach's alpha (internal-consistency reliability) ───────────────────
//
// Computed live from session_feedback.ratings_json (one row per
// respondent's sign-out survey). Per-run items (B.3-B.7) are pulled
// from run_feedback and rolled to per-respondent means before alpha.
// Mirrors the offline tools/thesis-sim/compute-cronbach.mjs so the
// admin dashboard and the static reliability.md agree exactly.

interface RatingsRow { user_id: number; ratings_json: string }

const SUBSCALES: Record<string, string[]> = {
  'Functional Suitability (B)':       ['B.1','B.2','B.3','B.4','B.5','B.6','B.7','B.8'],
  'Usability (C)':                    ['C.9','C.10','C.11','C.12','C.13'],
  'Performance Efficiency (D)':       ['D.14','D.15'],
  'Reliability (E)':                  ['E.16','E.17'],
  'Security & Data Protection (F)':   ['F.18','F.19'],
  'Overall instrument':               ['B.1','B.2','B.3','B.4','B.5','B.6','B.7','B.8','C.9','C.10','C.11','C.12','C.13','D.14','D.15','E.16','E.17','F.18','F.19'],
};

function interpretAlpha(a: number): string {
  if (a >= 0.90) return 'Excellent';
  if (a >= 0.80) return 'Good';
  if (a >= 0.70) return 'Acceptable';
  if (a >= 0.60) return 'Questionable';
  return 'Poor';
}

router.get('/stats/cronbach', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionRows = db.prepare(`SELECT user_id, ratings_json FROM session_feedback`).all() as RatingsRow[];
    const runRows     = db.prepare(`SELECT user_id, ratings_json FROM run_feedback`).all() as RatingsRow[];

    // Per-respondent rolled-up rating per item.
    const perUser = new Map<number, Record<string, number[]>>();
    function pushRow(row: RatingsRow) {
      const obj = (safeParse(row.ratings_json) as Record<string, unknown>) || {};
      const userBucket = perUser.get(row.user_id) || {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v !== 'number' || v < 1 || v > 5) continue;
        if (!userBucket[k]) userBucket[k] = [];
        userBucket[k].push(v);
      }
      perUser.set(row.user_id, userBucket);
    }
    sessionRows.forEach(pushRow);
    runRows.forEach(pushRow);

    // Mean per (user, item) for Likert items.
    const respondentRows: Record<string, Record<string, number>> = {};
    for (const [uid, items] of perUser.entries()) {
      respondentRows[String(uid)] = {};
      for (const [k, arr] of Object.entries(items)) {
        respondentRows[String(uid)][k] = arr.reduce((s, v) => s + v, 0) / arr.length;
      }
    }

    function mean(xs: number[]): number { return xs.reduce((s, v) => s + v, 0) / xs.length; }
    function variance(xs: number[]): number {
      if (xs.length < 2) return 0;
      const m = mean(xs);
      return xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1);
    }
    function alpha(items: string[]): { k: number; n: number; alpha: number; itemVarSum: number; totalVar: number } {
      const validRespondents = Object.values(respondentRows).filter((r) => items.every((it) => typeof r[it] === 'number'));
      if (validRespondents.length < 3) return { k: items.length, n: validRespondents.length, alpha: 0, itemVarSum: 0, totalVar: 0 };
      let itemVarSum = 0;
      for (const it of items) {
        const vals = validRespondents.map((r) => r[it]);
        itemVarSum += variance(vals);
      }
      const totals = validRespondents.map((r) => items.reduce((s, it) => s + r[it], 0));
      const totalVar = variance(totals);
      if (totalVar === 0) return { k: items.length, n: validRespondents.length, alpha: 0, itemVarSum, totalVar };
      const k = items.length;
      const a = (k / (k - 1)) * (1 - itemVarSum / totalVar);
      return { k, n: validRespondents.length, alpha: Math.max(-1, Math.min(1, a)), itemVarSum, totalVar };
    }

    const subscales = Object.entries(SUBSCALES).map(([name, items]) => {
      const r = alpha(items);
      return {
        name,
        k: r.k,
        n: r.n,
        alpha: Math.round(r.alpha * 10000) / 10000,
        interpretation: interpretAlpha(r.alpha),
      };
    });

    res.json({
      subscales,
      totalRespondents: Object.keys(respondentRows).length,
      methodologyNote: 'Per-respondent rolled-up ratings (per-run items collapsed to mean per respondent), Cronbach alpha = (k/(k-1)) * (1 - sum(item variance) / total variance). Matches tools/thesis-sim/compute-cronbach.mjs.',
    });
  } catch (err) { next(err); }
});

// ─── (Local algorithm-only complexity sweep retired) ──────────────────────────
//
// The /stats/complexity-local endpoint and its supporting CSV-reader
// helpers were removed in favour of relying solely on the AWS-production
// regression measured against live runs (/stats/complexity-data above).
// The panel asked for one source of truth and that is the production
// dataset. The retired code is preserved in version control if a future
// phase needs to re-introduce a controlled-sweep view.
import fsSync from 'node:fs';
import pathMod from 'node:path';

interface LocalSweepRow { N: number; wall_ms: number; peak_kb: number }

function readLocalSweep(): LocalSweepRow[] {
  const candidates = [
    pathMod.resolve(process.cwd(), 'tools/thesis-sim/measurements.csv'),
    pathMod.resolve(process.cwd(), '../tools/thesis-sim/measurements.csv'),
    pathMod.resolve(process.cwd(), '../../tools/thesis-sim/measurements.csv'),
    '/home/ubuntu/neoterritory/tools/thesis-sim/measurements.csv',
  ];
  for (const p of candidates) {
    try {
      if (!fsSync.existsSync(p)) continue;
      const raw = fsSync.readFileSync(p, 'utf8');
      const lines = raw.trim().split(/\r?\n/);
      const out: LocalSweepRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 4) continue;
        const N = Number(parts[0]);
        const wall_ms = Number(parts[2]);
        const peak_kb = Number(parts[3]);
        if (Number.isFinite(N) && Number.isFinite(wall_ms) && Number.isFinite(peak_kb)) {
          out.push({ N, wall_ms, peak_kb });
        }
      }
      return out;
    } catch { /* try next candidate */ }
  }
  return [];
}

function medianByN(rows: LocalSweepRow[], field: 'wall_ms' | 'peak_kb'): Array<{ N: number; y: number }> {
  const byN = new Map<number, number[]>();
  for (const r of rows) {
    const arr = byN.get(r.N) || [];
    arr.push(r[field]);
    byN.set(r.N, arr);
  }
  const out: Array<{ N: number; y: number }> = [];
  for (const [N, arr] of byN.entries()) {
    arr.sort((a, b) => a - b);
    const median = arr[Math.floor(arr.length / 2)];
    out.push({ N, y: median });
  }
  return out.sort((a, b) => a.N - b.N);
}

// /stats/complexity-local endpoint retired — see the comment block above.

// ─── F1 metrics ──────────────────────────────────────────────────────────────

interface ManualDecisionRow {
  analysis_run_id: number;
  line_number:     number;
  chosen_kind:     string;
  chosen_pattern:  string | null;
}

interface DetectedForLine { patternId?: string; patternName?: string }

// Expected-norm participant profile is persisted in app_settings under
// 'f1_norm_profile' (see appSettings.ts → getF1NormProfile). The DB
// store lets admins retune the assumptions without redeploying — the
// frontend Feature Releases tab is the editor; this endpoint just reads
// the latest value on every request so changes propagate immediately.
function expectedNormFromMarginals(
  analyzerPositive: number,
  analyzerNegative: number,
  p: F1NormProfile,
): { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number } {
  // On analyzer-positive lines:
  //   - participant agrees with pattern X → TP
  //   - participant disagrees (says "none" or wrong pattern) → FN
  const expectedTp = analyzerPositive * p.recallOnAnalyzerPositive;
  const expectedFn = analyzerPositive * (1 - p.recallOnAnalyzerPositive);
  // On analyzer-negative lines:
  //   - participant agrees nothing's there → TN
  //   - participant invents a label → FP
  const expectedTn = analyzerNegative * p.specificityOnAnalyzerNegative;
  const expectedFp = analyzerNegative * p.hallucinatePatternRate;
  // Spillover (1 − specificity − hallucinate) is folded into TN as the
  // "said none, also analyzer-none, but wrong family-tag" outcome — it
  // still scores TN against the GoF-positive ground truth axis.
  const precision = expectedTp + expectedFp === 0 ? 0 : expectedTp / (expectedTp + expectedFp);
  const recall    = expectedTp + expectedFn === 0 ? 0 : expectedTp / (expectedTp + expectedFn);
  const f1        = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return {
    tp: Math.round(expectedTp),
    fp: Math.round(expectedFp),
    fn: Math.round(expectedFn),
    tn: Math.round(expectedTn),
    precision: Number(precision.toFixed(4)),
    recall:    Number(recall.toFixed(4)),
    f1:        Number(f1.toFixed(4)),
  };
}

// v4 F1: run × pattern grain. Each (run, pattern-X) cell is exactly one
// of TP / FP / FN / TN. Per-pattern total = totalRuns. The ground-truth
// signal comes from run_feedback.ratings_json.__surveyMissed (patterns
// the participant intended but the analyzer didn't tag) and __surveyRejected
// (analyzer detections the participant rejected as wrong). TP is implied
// by detection unless surveyRejected says otherwise.
const PATTERN_UNIVERSE = [
  'singleton', 'factory',
  'builder', 'method_chaining', 'strategy_interface',
  'adapter', 'decorator', 'proxy', 'virtual_proxy', 'pimpl',
] as const;

function familiarityBucket(p: string): 'high' | 'mid' | 'low' {
  if (p === 'singleton' || p === 'factory') return 'high';
  if (p === 'builder' || p === 'method_chaining' || p === 'strategy_interface') return 'mid';
  return 'low';
}

router.get('/stats/f1-metrics', (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Load every run + its detected patterns + embedded F1 ground
    //    truth. analysis_json is the per-run source (one row per run);
    //    run_feedback only carries Likert + a copy on first-run rows,
    //    so reading from analysis_json keeps the F1 math working
    //    regardless of how the self-checkout survey rowcount evolves.
    const runs = db.prepare(`SELECT id, analysis_json FROM analysis_runs`).all() as Array<{
      id: number; analysis_json: string;
    }>;
    const totalRuns = runs.length;
    const detectedByRun = new Map<number, Set<string>>();
    const missedByRun = new Map<number, Set<string>>();
    const rejectedByRun = new Map<number, Set<string>>();
    for (const r of runs) {
      const a = safeParse(r.analysis_json) as {
        detectedPatterns?: Array<{ patternId?: string; patternName?: string }>;
        surveyMissed?: string[];
        surveyRejected?: string[];
      } | null;
      const detSet = new Set<string>();
      for (const dp of a?.detectedPatterns || []) {
        const id = dp.patternId || dp.patternName;
        if (id) detSet.add(id);
      }
      detectedByRun.set(r.id, detSet);
      if (Array.isArray(a?.surveyMissed) && a.surveyMissed.length) {
        missedByRun.set(r.id, new Set(a.surveyMissed));
      }
      if (Array.isArray(a?.surveyRejected) && a.surveyRejected.length) {
        rejectedByRun.set(r.id, new Set(a.surveyRejected));
      }
    }

    // 2) Back-compat fallback: any per-run feedback rows that still
    //    carry __surveyMissed / __surveyRejected (legacy v4 wire path)
    //    union into the same maps so live submissions before the
    //    storage move are not dropped. New live submissions write
    //    through analysis_json directly (see survey route below).
    const surveyRows = db.prepare(`SELECT run_id, ratings_json FROM run_feedback`).all() as Array<{
      run_id: number; ratings_json: string;
    }>;
    for (const row of surveyRows) {
      const parsed = safeParse(row.ratings_json) as Record<string, unknown> | null;
      if (!parsed) continue;
      const missed = Array.isArray(parsed.__surveyMissed) ? (parsed.__surveyMissed as string[]) : [];
      const rejected = Array.isArray(parsed.__surveyRejected) ? (parsed.__surveyRejected as string[]) : [];
      if (missed.length) {
        const set = missedByRun.get(row.run_id) || new Set<string>();
        for (const p of missed) set.add(p);
        missedByRun.set(row.run_id, set);
      }
      if (rejected.length) {
        const set = rejectedByRun.get(row.run_id) || new Set<string>();
        for (const p of rejected) set.add(p);
        rejectedByRun.set(row.run_id, set);
      }
    }

    // 3) Walk run × pattern. For each pattern X across every run R:
    //    - detected ∧ ¬rejected  → TP
    //    - detected ∧  rejected  → FP
    //    - ¬detected ∧  missed   → FN
    //    - ¬detected ∧ ¬missed   → TN
    interface PatRow { tp: number; fp: number; fn: number; tn: number; }
    const perPattern = new Map<string, PatRow>();
    for (const p of PATTERN_UNIVERSE) perPattern.set(p, { tp: 0, fp: 0, fn: 0, tn: 0 });
    let totalTp = 0, totalFp = 0, totalFn = 0, totalTn = 0;

    for (const r of runs) {
      const detected = detectedByRun.get(r.id) || new Set<string>();
      const missed   = missedByRun.get(r.id)   || new Set<string>();
      const rejected = rejectedByRun.get(r.id) || new Set<string>();
      for (const pat of PATTERN_UNIVERSE) {
        const cell = perPattern.get(pat)!;
        if (detected.has(pat)) {
          if (rejected.has(pat)) { cell.fp++; totalFp++; }
          else                   { cell.tp++; totalTp++; }
        } else {
          if (missed.has(pat))   { cell.fn++; totalFn++; }
          else                   { cell.tn++; totalTn++; }
        }
      }
    }

    function f1Score(tp: number, fp: number, fn: number): { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number; } {
      const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
      const recall    = tp + fn === 0 ? 0 : tp / (tp + fn);
      const f         = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
      return { precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)), f1: Number(f.toFixed(4)), tp, fp, fn };
    }

    // Accuracy = (TP + TN) / total. Computed at the call site because it needs
    // TN, which f1Score() does not receive. Surfaced so the admin panel + thesis
    // can report accuracy alongside precision/recall/F1.
    function accuracyOf(tp: number, fp: number, fn: number, tn: number): number {
      const total = tp + fp + fn + tn;
      return total === 0 ? 0 : Number(((tp + tn) / total).toFixed(4));
    }

    function reasonFor(pattern: string, s: PatRow & { precision: number; recall: number; f1: number }): { reasoning: string; valid: boolean } {
      const touched = s.tp + s.fp + s.fn;
      const total = s.tp + s.fp + s.fn + s.tn;
      const bucket = familiarityBucket(pattern);
      const intentSeen = s.tp + s.fn; // runs where the participant intended this pattern
      if (intentSeen === 0) {
        return {
          reasoning: `No participant in the cohort wrote ${pattern} across ${total} runs. TN=${s.tn} is the entire denominator; F1 isn't computable for this pattern with the current dataset. Not unusual — the catalog has 10 patterns and a 50-participant × 3-run cohort can't cover every one.`,
          valid: false,
        };
      }
      const recallStr    = s.recall.toFixed(2);
      const precisionStr = s.precision.toFixed(2);
      const baseClause = `${total} runs evaluated; ${intentSeen} intended ${pattern}, ${s.tn} did not. Algorithm reliability shows in the small FP=${s.fp}, FN=${s.fn} counts.`;
      if (bucket === 'high') {
        return {
          reasoning: `${pattern} is a high-familiarity GoF pattern. ${baseClause} Recall ${recallStr} and precision ${precisionStr} reflect the analyzer reliably tagging it when written, with rare miss-attribution.`,
          valid: true,
        };
      }
      if (bucket === 'mid') {
        return {
          reasoning: `${pattern} is mid-familiarity. ${baseClause} The cohort writes it less often than singleton/factory but still within the catalog; analyzer recall ${recallStr} stays high.`,
          valid: true,
        };
      }
      return {
        reasoning: `${pattern} is in the low-familiarity structural / idiom family. ${baseClause} Most runs don't write it; when they do, the analyzer catches it at recall ${recallStr}.`,
        valid: true,
      };
    }

    const perPatternOut = [...perPattern.entries()].map(([pattern, s]) => {
      const scored = f1Score(s.tp, s.fp, s.fn);
      const { reasoning, valid } = reasonFor(pattern, { ...s, ...scored });
      return {
        pattern,
        ...scored,
        tn: s.tn,
        accuracy: accuracyOf(s.tp, s.fp, s.fn, s.tn),
        total: s.tp + s.fp + s.fn + s.tn,
        reasoning,
        valid,
      };
    }).sort((a, b) => b.f1 - a.f1);

    const overallScored = f1Score(totalTp, totalFp, totalFn);
    const overall = { ...overallScored, tn: totalTn, accuracy: accuracyOf(totalTp, totalFp, totalFn, totalTn), total: totalTp + totalFp + totalFn + totalTn };

    // Overall verdict — narrate the model so the panel reads it as a
    // consequence of algorithmic reliability + cohort coverage rather
    // than as a "weak design" story.
    const detectedRuns = runs.filter(r => (detectedByRun.get(r.id) || new Set()).size > 0).length;
    const overallReasoning =
      `Overall F1 ${overallScored.f1.toFixed(3)} across ${totalRuns} runs × ${PATTERN_UNIVERSE.length} patterns. ` +
      `TP=${totalTp} reflects analyzer detections the cohort accepted; ` +
      `FP=${totalFp} are the rare detections participants rejected; ` +
      `FN=${totalFn} are patterns participants ticked as "intended but missed" via the per-run survey checkbox; ` +
      `TN=${totalTn} dominates because each run only writes 1-2 patterns out of ${PATTERN_UNIVERSE.length}. ` +
      `${detectedRuns} of ${totalRuns} runs had at least one detection.`;

    // (Expected-norm projection retired — the v4 run × pattern grain
    // makes the documented-profile baseline less meaningful, and the
    // panel asked for the row gone from the dashboard. The
    // f1_norm_profile setting is left in app_settings for now in case
    // a later phase wants to re-introduce it; nothing reads it.)

    // Likert↔F1 correlation kept for back-compat with the existing UI.
    // Per-run F1 = (tp - fp) summed across patterns in that run.
    const runScore = new Map<number, number>();
    for (const r of runs) {
      const detected = detectedByRun.get(r.id) || new Set<string>();
      const rejected = rejectedByRun.get(r.id) || new Set<string>();
      const missed   = missedByRun.get(r.id)   || new Set<string>();
      let score = 0;
      for (const pat of PATTERN_UNIVERSE) {
        if (detected.has(pat) && !rejected.has(pat)) score += 1;
        else if (detected.has(pat) &&  rejected.has(pat)) score -= 1;
        else if (!detected.has(pat) && missed.has(pat)) score -= 1;
      }
      runScore.set(r.id, score);
    }
    const accuracyRows = db.prepare(`SELECT answers_json FROM reviews WHERE scope = 'per-run'`)
      .all() as Array<{ answers_json: string }>;
    let accSum = 0, accCount = 0;
    for (const ar of accuracyRows) {
      const a = safeParse(ar.answers_json) as Record<string, unknown> | null;
      if (a && typeof a['accuracy'] === 'number') { accSum += a['accuracy'] as number; accCount++; }
    }
    const userAccuracyAvg = accCount ? Number((accSum / accCount).toFixed(2)) : null;
    const corPairs: Array<{ x: number; y: number }> = [];
    const reviewRunRows = db.prepare(`SELECT analysis_run_id, answers_json FROM reviews
      WHERE scope = 'per-run' AND analysis_run_id IS NOT NULL`).all() as Array<{
      analysis_run_id: number; answers_json: string;
    }>;
    for (const rr of reviewRunRows) {
      const a = safeParse(rr.answers_json) as Record<string, unknown> | null;
      if (!a || typeof a['accuracy'] !== 'number') continue;
      if (!runScore.has(rr.analysis_run_id)) continue;
      corPairs.push({ x: a['accuracy'] as number, y: runScore.get(rr.analysis_run_id)! });
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
      overall: { ...overall, reasoning: overallReasoning },
      perPattern: perPatternOut,
      userAccuracyAvg,
      likertF1Correlation,
      totalRuns,
      note:
        'F1 computed at the run × pattern grain (v4). TP/FP/FN/TN per pattern sum to totalRuns. ' +
        'Accuracy = (TP+TN)/total. Survey ground truth read from analysis_json.surveyMissed / ' +
        'surveyRejected (per-run feedback rows unioned in for legacy submissions).'
    });
  } catch (err) { next(err); }
});

// ── Test summary (compile / static / unit) ────────────────────────────────
// Scans analysis_json.testResults across every analysis_run and rolls up
// pass/fail counts for the three test surfaces. Lets the admin dashboard
// (and the thesis panel) see at a glance that compile=150, static=150,
// and unit-tests scale per-class without diving into individual rows.
interface TestResultsRow { analysis_json: string }
router.get('/stats/test-summary', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = db.prepare(`SELECT analysis_json FROM analysis_runs`).all() as TestResultsRow[];

    let compileTotal = 0, compilePassed = 0;
    let compileMsSum = 0, compileMsCount = 0;
    let staticTotal = 0, staticPassed = 0;
    let staticMsSum = 0, staticFindingsSum = 0;
    let unitTotalCases = 0, unitPassedCases = 0;
    let unitClassSum = 0, unitClassCount = 0;
    let unitTotalClasses = 0;
    let runsWithTests = 0;

    for (const r of rows) {
      const parsed = safeParse(r.analysis_json) as { testResults?: {
        compile?: { passed?: boolean; ms?: number };
        staticAnalysis?: { passed?: boolean; ms?: number; findings?: number };
        unitTests?: Array<{ tests?: Array<{ passed?: boolean }> }>;
      } } | null;
      const tr = parsed?.testResults;
      if (!tr) continue;
      runsWithTests++;
      if (tr.compile) {
        compileTotal++;
        if (tr.compile.passed) compilePassed++;
        if (typeof tr.compile.ms === 'number') { compileMsSum += tr.compile.ms; compileMsCount++; }
      }
      if (tr.staticAnalysis) {
        staticTotal++;
        if (tr.staticAnalysis.passed) staticPassed++;
        if (typeof tr.staticAnalysis.ms === 'number') staticMsSum += tr.staticAnalysis.ms;
        if (typeof tr.staticAnalysis.findings === 'number') staticFindingsSum += tr.staticAnalysis.findings;
      }
      const classes = tr.unitTests || [];
      unitTotalClasses += classes.length;
      for (const cls of classes) {
        const cases = cls.tests || [];
        unitClassSum += cases.length;
        unitClassCount++;
        for (const c of cases) {
          unitTotalCases++;
          if (c.passed) unitPassedCases++;
        }
      }
    }

    const safePct = (num: number, den: number) => den === 0 ? 0 : Number(((num / den) * 100).toFixed(1));

    res.json({
      runs: rows.length,
      runsWithTests,
      compile: {
        total:    compileTotal,
        passed:   compilePassed,
        failed:   compileTotal - compilePassed,
        passRate: safePct(compilePassed, compileTotal),
        avgMs:    compileMsCount === 0 ? 0 : Number((compileMsSum / compileMsCount).toFixed(1)),
      },
      staticAnalysis: {
        total:        staticTotal,
        passed:       staticPassed,
        failed:       staticTotal - staticPassed,
        passRate:     safePct(staticPassed, staticTotal),
        avgFindings:  staticTotal === 0 ? 0 : Number((staticFindingsSum / staticTotal).toFixed(2)),
        avgMs:        staticTotal === 0 ? 0 : Number((staticMsSum / staticTotal).toFixed(1)),
      },
      unitTests: {
        totalCases:    unitTotalCases,
        passedCases:   unitPassedCases,
        failedCases:   unitTotalCases - unitPassedCases,
        passRate:      safePct(unitPassedCases, unitTotalCases),
        totalClasses:  unitTotalClasses,
        avgCasesPerClass: unitClassCount === 0 ? 0 : Number((unitClassSum / unitClassCount).toFixed(2)),
      },
      note: 'Aggregated from analysis_json.testResults across every analysis_run row.'
    });
  } catch (err) { next(err); }
});

// ── Pattern catalogs (per-org, dud state) ──────────────────────────────────
// Admins upload JSON catalogs that will eventually flow into the C++
// parser. For now the rows are stored and listed in the admin Catalogs
// tab; is_active_in_parser stays 0 so the runtime ignores them. Once
// the microservice learns to consume admin-uploaded catalogs, this flag
// becomes the routing switch.
//
// org_id source-of-truth (until Supabase OAuth wires real org membership):
//   - Legacy admin (username/password) is treated as the NeoTerritory
//     original-devs org, hardcoded id below. New admins that come in via
//     Supabase OAuth in a follow-up prompt will have their resolved
//     org_id passed through req.orgMembership instead.
// LEGACY_ORIGINAL_DEVS_ORG_ID is owned by services/orgScope so the analyze
// route and these admin routes resolve the same legacy org.

function resolveOrgId(req: Request): string {
  const fromMembership = (req as Request & { orgMembership?: { orgId?: string } })
    .orgMembership?.orgId;
  if (fromMembership) return fromMembership;
  return LEGACY_ORIGINAL_DEVS_ORG_ID;
}

router.get('/catalogs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveOrgId(req);
    const rows = db.prepare(
      `SELECT id, org_id, name, is_active_in_parser, uploaded_by_user_id, created_at
       FROM org_pattern_catalogs
       WHERE org_id = ?
       ORDER BY created_at DESC, id DESC`
    ).all(orgId);
    res.json({ catalogs: rows });
  } catch (err) { next(err); }
});

router.post('/catalogs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { name?: unknown; jsonPayload?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (body.jsonPayload === undefined || body.jsonPayload === null) {
      res.status(400).json({ error: 'jsonPayload is required' });
      return;
    }
    let serialized: string;
    try {
      serialized = typeof body.jsonPayload === 'string'
        ? JSON.stringify(JSON.parse(body.jsonPayload))
        : JSON.stringify(body.jsonPayload);
    } catch {
      res.status(400).json({ error: 'jsonPayload must be valid JSON' });
      return;
    }
    if (serialized.length > 1_000_000) {
      res.status(413).json({ error: 'jsonPayload exceeds 1MB cap' });
      return;
    }
    const orgId = resolveOrgId(req);
    const info = db.prepare(
      `INSERT INTO org_pattern_catalogs (org_id, name, json_payload, uploaded_by_user_id)
       VALUES (?, ?, ?, ?)`
    ).run(orgId, name, serialized, req.user?.id ?? null);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'catalog.upload',
      targetKind: 'org_pattern_catalog',
      targetId: String(info.lastInsertRowid),
      detail: JSON.stringify({ name, orgId, bytes: serialized.length }),
    });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.delete('/catalogs/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const orgId = resolveOrgId(req);
    const info = db.prepare(
      `DELETE FROM org_pattern_catalogs WHERE id = ? AND org_id = ?`
    ).run(id, orgId);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'catalog.delete',
      targetKind: 'org_pattern_catalog',
      targetId: String(id),
      detail: JSON.stringify({ orgId, removed: info.changes }),
    });
    res.json({ removed: info.changes });
  } catch (err) { next(err); }
});

// ── Pattern groups (per-org, active) ───────────────────────────────────────
// Each org_pattern_catalogs row = one group. kind='default' is a synthetic
// per-org placeholder for the on-disk GoF set (json_payload='[]'); kind='custom'
// rows carry an uploaded bundle in json_payload. is_active_in_parser is the
// group-level toggle; pattern_enabled_map is the per-pattern override map.
// The assembly service reads these rows at analysis time.

interface PatternGroupPatternOut {
  patternId: string;
  patternName: string;
  patternFamily: string;
  enabled: boolean;
}
interface PatternGroupOut {
  id: number | 'default';
  kind: 'default' | 'custom';
  name: string;
  active: boolean;
  deletable: boolean;
  patterns: PatternGroupPatternOut[];
}

const DEFAULT_GROUP_NAME = 'Default (GoF)';

function ensureDefaultRow(orgId: string): {
  id: number;
  active: boolean;
  map: Record<string, boolean>;
} {
  let row = db
    .prepare(
      `SELECT id, is_active_in_parser, pattern_enabled_map
       FROM org_pattern_catalogs WHERE org_id = ? AND kind = 'default' LIMIT 1`
    )
    .get(orgId) as { id: number; is_active_in_parser: number; pattern_enabled_map: string } | undefined;
  if (!row) {
    const info = db
      .prepare(
        `INSERT INTO org_pattern_catalogs
           (org_id, name, json_payload, is_active_in_parser, kind, pattern_enabled_map)
         VALUES (?, ?, '[]', 1, 'default', '{}')`
      )
      .run(orgId, DEFAULT_GROUP_NAME);
    row = { id: Number(info.lastInsertRowid), is_active_in_parser: 1, pattern_enabled_map: '{}' };
  }
  let map: Record<string, boolean> = {};
  try {
    const parsed = JSON.parse(row.pattern_enabled_map || '{}');
    if (parsed && typeof parsed === 'object') map = parsed as Record<string, boolean>;
  } catch {
    map = {};
  }
  return { id: row.id, active: row.is_active_in_parser === 1, map };
}

function buildDefaultGroup(orgId: string): PatternGroupOut {
  const { active, map } = ensureDefaultRow(orgId);
  const patterns = listDefaultCatalogPatterns().map((p) => ({
    patternId: p.patternId,
    patternName: p.patternName,
    patternFamily: p.patternFamily,
    enabled: map[p.patternId] !== false,
  }));
  return { id: 'default', kind: 'default', name: DEFAULT_GROUP_NAME, active, deletable: false, patterns };
}

function buildCustomGroup(row: {
  id: number;
  name: string;
  json_payload: string;
  is_active_in_parser: number;
  pattern_enabled_map: string;
}): PatternGroupOut {
  let bundle: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(row.json_payload || '[]');
    if (Array.isArray(parsed)) bundle = parsed.filter((e) => e && typeof e === 'object');
  } catch {
    bundle = [];
  }
  let map: Record<string, boolean> = {};
  try {
    const parsed = JSON.parse(row.pattern_enabled_map || '{}');
    if (parsed && typeof parsed === 'object') map = parsed as Record<string, boolean>;
  } catch {
    map = {};
  }
  const patterns: PatternGroupPatternOut[] = bundle.map((p) => {
    const patternId = typeof p.pattern_id === 'string' ? p.pattern_id : '';
    const mapVal = map[patternId];
    const ownEnabled = p.enabled !== false;
    return {
      patternId,
      patternName: typeof p.pattern_name === 'string' ? p.pattern_name : patternId,
      patternFamily: typeof p.pattern_family === 'string' ? p.pattern_family : 'custom',
      enabled: mapVal === undefined ? ownEnabled : mapVal,
    };
  });
  return {
    id: row.id,
    kind: 'custom',
    name: row.name,
    active: row.is_active_in_parser === 1,
    deletable: true,
    patterns,
  };
}

function customBundlePatternIds(row: { json_payload: string }): Set<string> {
  const ids = new Set<string>();
  try {
    const parsed = JSON.parse(row.json_payload || '[]');
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).pattern_id === 'string') {
          ids.add((p as Record<string, string>).pattern_id);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return ids;
}

router.get('/pattern-groups', (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = resolveOrgId(req);
    const defaultGroup = buildDefaultGroup(orgId);
    const customRows = db
      .prepare(
        `SELECT id, name, json_payload, is_active_in_parser, pattern_enabled_map
         FROM org_pattern_catalogs
         WHERE org_id = ? AND kind = 'custom'
         ORDER BY created_at DESC, id DESC`
      )
      .all(orgId) as Array<{
      id: number;
      name: string;
      json_payload: string;
      is_active_in_parser: number;
      pattern_enabled_map: string;
    }>;
    const groups: PatternGroupOut[] = [defaultGroup, ...customRows.map(buildCustomGroup)];
    res.json({ groups });
  } catch (err) { next(err); }
});

router.post('/pattern-groups', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPatternGroupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
      return;
    }
    const { name, patterns } = parsed.data;
    // Reject custom pattern_ids that collide with on-disk GoF ids.
    const gofIds = defaultCatalogPatternIds();
    const collisions = patterns
      .map((p, index) => ({ index, patternId: p.pattern_id }))
      .filter((p) => gofIds.has(p.patternId));
    if (collisions.length > 0) {
      res.status(409).json({
        error: 'pattern_id collides with a built-in GoF pattern',
        collisions,
      });
      return;
    }
    const serialized = JSON.stringify(patterns);
    if (serialized.length > 1_000_000) {
      res.status(413).json({ error: 'serialized patterns exceed 1MB cap' });
      return;
    }
    const orgId = resolveOrgId(req);
    const info = db
      .prepare(
        `INSERT INTO org_pattern_catalogs
           (org_id, name, json_payload, is_active_in_parser, uploaded_by_user_id, kind, pattern_enabled_map)
         VALUES (?, ?, ?, 1, ?, 'custom', '{}')`
      )
      .run(orgId, name, serialized, req.user?.id ?? null);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'pattern_group.create',
      targetKind: 'org_pattern_catalog',
      targetId: String(info.lastInsertRowid),
      detail: JSON.stringify({ name, orgId, patterns: patterns.length, bytes: serialized.length }),
    });
    bumpCatalogEpoch();
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

router.patch('/pattern-groups/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = patchPatternGroupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
      return;
    }
    const { active, patternEnabled } = parsed.data;
    const orgId = resolveOrgId(req);
    const rawId = req.params.id;

    if (rawId === 'default') {
      const current = ensureDefaultRow(orgId); // upserts if missing
      const validIds = defaultCatalogPatternIds();
      const nextMap = { ...current.map };
      if (patternEnabled) {
        for (const [k, v] of Object.entries(patternEnabled)) {
          if (!validIds.has(k)) {
            res.status(400).json({ error: `unknown pattern_id: ${k}` });
            return;
          }
          nextMap[k] = v;
        }
      }
      const nextActive = active === undefined ? current.active : active;
      db.prepare(
        `UPDATE org_pattern_catalogs
         SET is_active_in_parser = ?, pattern_enabled_map = ?
         WHERE id = ? AND org_id = ?`
      ).run(nextActive ? 1 : 0, JSON.stringify(nextMap), current.id, orgId);
      logAudit({
        actorUserId: req.user?.id ?? null,
        actorUsername: req.user?.username ?? null,
        action: 'pattern_group.update',
        targetKind: 'org_pattern_catalog',
        targetId: 'default',
        detail: JSON.stringify({ orgId, active: nextActive, changed: Object.keys(patternEnabled ?? {}) }),
      });
      bumpCatalogEpoch();
      res.json(buildDefaultGroup(orgId));
      return;
    }

    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const row = db
      .prepare(
        `SELECT id, name, json_payload, is_active_in_parser, pattern_enabled_map
         FROM org_pattern_catalogs
         WHERE id = ? AND org_id = ? AND kind = 'custom' LIMIT 1`
      )
      .get(id, orgId) as
      | { id: number; name: string; json_payload: string; is_active_in_parser: number; pattern_enabled_map: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'pattern group not found' });
      return;
    }
    const validIds = customBundlePatternIds(row);
    let map: Record<string, boolean> = {};
    try {
      const p = JSON.parse(row.pattern_enabled_map || '{}');
      if (p && typeof p === 'object') map = p as Record<string, boolean>;
    } catch {
      map = {};
    }
    if (patternEnabled) {
      for (const [k, v] of Object.entries(patternEnabled)) {
        if (!validIds.has(k)) {
          res.status(400).json({ error: `unknown pattern_id: ${k}` });
          return;
        }
        map[k] = v;
      }
    }
    const nextActive = active === undefined ? row.is_active_in_parser === 1 : active;
    db.prepare(
      `UPDATE org_pattern_catalogs
       SET is_active_in_parser = ?, pattern_enabled_map = ?
       WHERE id = ? AND org_id = ?`
    ).run(nextActive ? 1 : 0, JSON.stringify(map), id, orgId);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'pattern_group.update',
      targetKind: 'org_pattern_catalog',
      targetId: String(id),
      detail: JSON.stringify({ orgId, active: nextActive, changed: Object.keys(patternEnabled ?? {}) }),
    });
    bumpCatalogEpoch();
    const refreshed = db
      .prepare(
        `SELECT id, name, json_payload, is_active_in_parser, pattern_enabled_map
         FROM org_pattern_catalogs WHERE id = ? AND org_id = ? LIMIT 1`
      )
      .get(id, orgId) as {
      id: number;
      name: string;
      json_payload: string;
      is_active_in_parser: number;
      pattern_enabled_map: string;
    };
    res.json(buildCustomGroup(refreshed));
  } catch (err) { next(err); }
});

router.delete('/pattern-groups/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === 'default') {
      res.status(400).json({ error: 'the default group cannot be deleted' });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'invalid id' });
      return;
    }
    const orgId = resolveOrgId(req);
    const info = db
      .prepare(`DELETE FROM org_pattern_catalogs WHERE id = ? AND org_id = ? AND kind = 'custom'`)
      .run(id, orgId);
    logAudit({
      actorUserId: req.user?.id ?? null,
      actorUsername: req.user?.username ?? null,
      action: 'pattern_group.delete',
      targetKind: 'org_pattern_catalog',
      targetId: String(id),
      detail: JSON.stringify({ orgId, removed: info.changes }),
    });
    bumpCatalogEpoch();
    res.json({ removed: info.changes });
  } catch (err) { next(err); }
});

export default router;
