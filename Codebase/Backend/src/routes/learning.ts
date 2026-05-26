// Per-account learning-path progress. The /patterns/learn surface runs a
// linear unlock gate: module N unlocks once module N-1 is completed. This
// router persists that progress per user so the path resumes where the
// account left off after a refresh or on another device.
//
// GET  /api/learning/progress  → { completedModuleIds, lastUnlockedModuleId,
//                                   theoryPassedModuleIds }
// PUT  /api/learning/progress  → upsert the same shape (called every time a
//                                module's theoretical or practical exam passes,
//                                which can unlock the next).
//
// theoryPassedModuleIds (D86): modules whose theoretical exam has passed. Kept
// separate from completedModuleIds so a learner who cleared a pattern module's
// theoretical exam but not its practical exam resumes mid-module after refresh.
import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { sanitizeAnswers } from '../services/learningQuestionStats';

const router = express.Router();

interface ProgressRow {
  completed_module_ids: string;
  last_unlocked_module_id: string | null;
  theory_passed_module_ids: string | null;
}

// Parse a JSON-array-of-strings DB column defensively. A corrupt or non-array
// payload degrades to an empty list rather than throwing.
function parseStringArrayColumn(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Normalise a request-body module-id array: strings only, deduped, length- and
// count-capped to the same bounds as completedModuleIds.
function sanitizeModuleIdArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_ID_LEN),
    ),
  ).slice(0, MAX_MODULES);
}

// Module-id sanity bounds — defensive caps so a malformed client cannot store
// an unbounded blob. There are well under 100 learning modules.
const MAX_MODULES = 200;
const MAX_ID_LEN = 120;
const MAX_PAYLOAD_BYTES = 20_000;

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
        `SELECT completed_module_ids, last_unlocked_module_id, theory_passed_module_ids
         FROM learning_progress WHERE user_id = ?`,
      )
      .get(req.user.id) as ProgressRow | undefined;

    res.json({
      completedModuleIds: parseStringArrayColumn(row?.completed_module_ids),
      lastUnlockedModuleId: row?.last_unlocked_module_id ?? null,
      theoryPassedModuleIds: parseStringArrayColumn(row?.theory_passed_module_ids),
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
      theoryPassedModuleIds?: unknown;
    };
    const completedModuleIds = sanitizeModuleIdArray(body.completedModuleIds);
    const theoryPassedModuleIds = sanitizeModuleIdArray(body.theoryPassedModuleIds);
    const lastUnlockedModuleId =
      typeof body.lastUnlockedModuleId === 'string' && body.lastUnlockedModuleId.length <= MAX_ID_LEN
        ? body.lastUnlockedModuleId
        : null;

    const serialized = JSON.stringify(completedModuleIds);
    const theorySerialized = JSON.stringify(theoryPassedModuleIds);
    if (serialized.length > MAX_PAYLOAD_BYTES || theorySerialized.length > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ error: 'progress payload too large' });
      return;
    }

    const triesByModule = sanitizeTries(body.triesByModule);
    const triesSerialized = JSON.stringify(triesByModule);

    db.prepare(
      `INSERT INTO learning_progress (user_id, completed_module_ids, last_unlocked_module_id, tries_by_module, theory_passed_module_ids, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         completed_module_ids      = excluded.completed_module_ids,
         last_unlocked_module_id   = excluded.last_unlocked_module_id,
         tries_by_module           = excluded.tries_by_module,
         theory_passed_module_ids  = excluded.theory_passed_module_ids,
         updated_at                = datetime('now')`,
    ).run(req.user.id, serialized, lastUnlockedModuleId, triesSerialized, theorySerialized);

    res.json({ ok: true, completedModuleIds, lastUnlockedModuleId, triesByModule, theoryPassedModuleIds });
  } catch (err) {
    next(err);
  }
});

// Per-question theoretical-exam results (D87). Called by the learner page on
// each exam submit for signed-in learners (the client guards guests). Upserts
// one row per (user, module, question); first_attempt_correct is locked on the
// first row and never overwritten. Best-effort from the client's view.
router.put('/answers', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as { moduleId?: unknown; attempt?: unknown; answers?: unknown };
    const moduleId =
      typeof body.moduleId === 'string' && body.moduleId.length > 0 && body.moduleId.length <= MAX_ID_LEN
        ? body.moduleId
        : null;
    if (!moduleId) {
      res.status(400).json({ error: 'moduleId required' });
      return;
    }
    const answers = sanitizeAnswers(body.answers);

    // attempts is DB-authoritative: 1 on first insert, +1 each subsequent
    // submit of this question. We do NOT trust a client-supplied attempt
    // counter (it feeds the admin drilldown, so it must reflect real submits).
    const upsert = db.prepare(
      `INSERT INTO learning_question_results
         (user_id, module_id, question_index, selected_index, is_correct, first_attempt_correct, attempts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, module_id, question_index) DO UPDATE SET
         selected_index = excluded.selected_index,
         is_correct     = excluded.is_correct,
         attempts       = learning_question_results.attempts + 1,
         updated_at     = datetime('now')`,
    );
    const tx = db.transaction((rows: typeof answers) => {
      for (const a of rows) {
        // On first insert first_attempt_correct = this submit's correctness;
        // the ON CONFLICT branch deliberately omits it so it is never updated.
        upsert.run(req.user!.id, moduleId, a.questionIndex, a.selectedIndex, a.isCorrect, a.isCorrect);
      }
    });
    tx(answers);

    res.json({ ok: true, recorded: answers.length });
  } catch (err) {
    next(err);
  }
});

export default router;
