// Per-account learning-path progress. The /patterns/learn surface runs a
// linear unlock gate: module N unlocks once module N-1 is completed. This
// router persists that progress per user so the path resumes where the
// account left off after a refresh or on another device.
//
// GET  /api/learning/progress  → { completedModuleIds, lastUnlockedModuleId }
// PUT  /api/learning/progress  → upsert the same shape (called every time a
//                                module is completed, which unlocks the next).
import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { getProficiencyBands } from '../db/appSettings';
import { mirrorRow } from '../services/supabaseLogger';

const router = express.Router();

interface ProgressRow {
  completed_module_ids: string;
  last_unlocked_module_id: string | null;
}

// Module-id sanity bounds — defensive caps so a malformed client cannot store
// an unbounded blob. There are well under 100 learning modules.
const MAX_MODULES = 200;
const MAX_ID_LEN = 120;
const MAX_PAYLOAD_BYTES = 20_000;

// Assessment scope / phase whitelist. Kept in sync with the frontend
// AssessmentScope / AssessmentPhase unions in data/learningAssessments.ts.
const ASSESSMENT_SCOPES = new Set([
  'path', 'foundations', 'creational', 'structural', 'behavioural', 'idioms',
]);
const ASSESSMENT_PHASES = new Set(['pre', 'post']);
const MAX_ANSWERS_BYTES = 10_000;

// Sanitize the per-module tries map: keys bounded like module ids, values
// coerced to a non-negative integer count.
function sanitizeTries(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (n >= MAX_MODULES) break;
    if (typeof k !== 'string' || !k || k.length > MAX_ID_LEN) continue;
    const num = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    out[k] = Math.min(num, 100_000);
    n += 1;
  }
  return out;
}

router.get('/progress', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const row = db
      .prepare(
        `SELECT completed_module_ids, last_unlocked_module_id
         FROM learning_progress WHERE user_id = ?`,
      )
      .get(req.user.id) as ProgressRow | undefined;

    let completedModuleIds: string[] = [];
    if (row) {
      try {
        const parsed = JSON.parse(row.completed_module_ids);
        if (Array.isArray(parsed)) {
          completedModuleIds = parsed.filter((x): x is string => typeof x === 'string');
        }
      } catch {
        /* corrupt row — treat as empty */
      }
    }
    res.json({
      completedModuleIds,
      lastUnlockedModuleId: row?.last_unlocked_module_id ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/progress', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as {
      completedModuleIds?: unknown;
      lastUnlockedModuleId?: unknown;
      triesByModule?: unknown;
    };
    const completedModuleIds = Array.isArray(body.completedModuleIds)
      ? Array.from(
          new Set(
            body.completedModuleIds
              .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_ID_LEN),
          ),
        ).slice(0, MAX_MODULES)
      : [];
    const lastUnlockedModuleId =
      typeof body.lastUnlockedModuleId === 'string' && body.lastUnlockedModuleId.length <= MAX_ID_LEN
        ? body.lastUnlockedModuleId
        : null;

    const serialized = JSON.stringify(completedModuleIds);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ error: 'progress payload too large' });
      return;
    }

    const triesByModule = sanitizeTries(body.triesByModule);
    const triesSerialized = JSON.stringify(triesByModule);

    db.prepare(
      `INSERT INTO learning_progress (user_id, completed_module_ids, last_unlocked_module_id, tries_by_module, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         completed_module_ids   = excluded.completed_module_ids,
         last_unlocked_module_id = excluded.last_unlocked_module_id,
         tries_by_module        = excluded.tries_by_module,
         updated_at             = datetime('now')`,
    ).run(req.user.id, serialized, lastUnlockedModuleId, triesSerialized);

    res.json({ ok: true, completedModuleIds, lastUnlockedModuleId, triesByModule });
  } catch (err) {
    next(err);
  }
});

// ── Pre/post knowledge-test scores ────────────────────────────────────────

interface AssessmentRow {
  scope: string;
  phase: string;
  correct: number;
  total: number;
  percent: number;
}

router.get('/assessment', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT scope, phase, correct, total, percent
         FROM learning_assessment WHERE user_id = ?`,
      )
      .all(req.user.id) as AssessmentRow[];
    res.json({ results: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/assessment', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as {
      scope?: unknown;
      phase?: unknown;
      correct?: unknown;
      total?: unknown;
      percent?: unknown;
      answers?: unknown;
    };
    const scope = typeof body.scope === 'string' ? body.scope : '';
    const phase = typeof body.phase === 'string' ? body.phase : '';
    if (!ASSESSMENT_SCOPES.has(scope) || !ASSESSMENT_PHASES.has(phase)) {
      res.status(400).json({ error: 'Invalid scope or phase' });
      return;
    }
    const total = Number(body.total);
    const correct = Number(body.correct);
    if (
      !Number.isInteger(total) || total <= 0 || total > 500 ||
      !Number.isInteger(correct) || correct < 0 || correct > total
    ) {
      res.status(400).json({ error: 'Invalid score' });
      return;
    }
    // Recompute percent server-side from correct/total — never trust the
    // client's percent, so analytics can't be poisoned by a forged value.
    const percent = Math.round((correct / total) * 100);
    const answers =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? (body.answers as Record<string, unknown>)
        : {};
    const answersSerialized = JSON.stringify(answers);
    if (answersSerialized.length > MAX_ANSWERS_BYTES) {
      res.status(413).json({ error: 'answers payload too large' });
      return;
    }

    const info = db.prepare(
      `INSERT INTO learning_assessment (user_id, scope, phase, correct, total, percent, answers_json, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, scope, phase) DO UPDATE SET
         correct      = excluded.correct,
         total        = excluded.total,
         percent      = excluded.percent,
         answers_json = excluded.answers_json,
         submitted_at = datetime('now')`,
    ).run(req.user.id, scope, phase, correct, total, percent, answersSerialized);

    mirrorRow('learning_assessment', {
      id: Number(info.lastInsertRowid),
      user_id: req.user.id, scope, phase, correct, total, percent,
      answers: answers, submitted_at: new Date().toISOString(),
    });

    res.status(201).json({ ok: true, scope, phase, correct, total, percent });
  } catch (err) {
    next(err);
  }
});

// Public proficiency bands (score range → label). No auth: the learner-facing
// result and the admin analytics both read the same admin-configured ranges.
router.get('/proficiency-bands', (_req: Request, res: Response, next: NextFunction): void => {
  try {
    res.json({ bands: getProficiencyBands() });
  } catch (err) {
    next(err);
  }
});

export default router;
