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

    db.prepare(
      `INSERT INTO learning_progress (user_id, completed_module_ids, last_unlocked_module_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         completed_module_ids   = excluded.completed_module_ids,
         last_unlocked_module_id = excluded.last_unlocked_module_id,
         updated_at             = datetime('now')`,
    ).run(req.user.id, serialized, lastUnlockedModuleId);

    res.json({ ok: true, completedModuleIds, lastUnlockedModuleId });
  } catch (err) {
    next(err);
  }
});

export default router;
