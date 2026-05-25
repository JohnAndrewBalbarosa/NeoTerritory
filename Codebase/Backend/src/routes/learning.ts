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

export default router;
