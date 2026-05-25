import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { validateBody } from '../middleware/validateBody';
import {
  runFeedbackSchema,
  sessionFeedbackSchema
} from '../validation/schemas';
import { logEvent } from '../services/logService';
import { mirrorRow } from '../services/supabaseLogger';
import { flushForRunId } from '../services/pendingRunPersistence';

const router = express.Router();

router.post('/run/:runId', jwtAuth, validateBody(runFeedbackSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // run_id column is now INTEGER + FK to analysis_runs(id). Coerce the
    // path param accordingly; reject non-numeric so we never insert junk
    // that the FK would reject silently on an older driver.
    const runIdNum = Number(req.params.runId);
    if (!Number.isFinite(runIdNum) || !Number.isInteger(runIdNum) || runIdNum <= 0) {
      res.status(400).json({ error: 'Invalid runId' });
      return;
    }
    const { ratings, openEnded, surveyMissed, surveyRejected } = req.body as {
      ratings: Record<string, number>;
      openEnded: Record<string, string>;
      surveyMissed?: string[];
      surveyRejected?: string[];
    };
    // Survey submission is the gate that flushes the buffered test-run
    // verdicts (gdb.compile_run.* / gdb.unit_test.* / gdb.run.complete)
    // to the DB. Both writes happen so admin queries cannot observe a
    // run with feedback but no verdicts, or vice versa. Flush is
    // idempotent — a second survey submit for the same runId is a no-op
    // on the buffered side (already drained).
    //
    // Per-run F1 ground truth (surveyMissed + surveyRejected) is stored
    // inside ratings_json alongside the Likert items so the F1 endpoint
    // reads a single row per run without a join.
    const ratingsPayload = {
      ...ratings,
      ...(surveyMissed   ? { __surveyMissed:   surveyMissed }   : {}),
      ...(surveyRejected ? { __surveyRejected: surveyRejected } : {}),
    };
    const rfInfo = db.prepare(
      `INSERT INTO run_feedback (run_id, user_id, ratings_json, open_json, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(runIdNum, req.user.id, JSON.stringify(ratingsPayload), JSON.stringify(openEnded));
    const flushResult = flushForRunId(runIdNum);
    mirrorRow('run_feedback', {
      id: Number(rfInfo.lastInsertRowid),
      run_id: runIdNum, user_id: req.user.id,
      ratings: ratingsPayload, open: openEnded,
      submitted_at: new Date().toISOString(),
    });
    logEvent(req.user.id, 'survey_run', `runId=${runIdNum} flushedRows=${flushResult.rowsWritten}`);
    res.status(201).json({ ok: true, flushedRows: flushResult.rowsWritten });
  } catch (err) {
    next(err);
  }
});

router.post('/session', jwtAuth, validateBody(sessionFeedbackSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { sessionUuid, ratings, openEnded } = req.body as {
      sessionUuid?: string;
      ratings: Record<string, number>;
      openEnded: Record<string, string>;
    };
    const uuid = sessionUuid || `${req.user.id}-${Date.now()}`;
    const sfInfo = db.prepare(
      `INSERT INTO session_feedback (user_id, session_uuid, ratings_json, open_json, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(req.user.id, uuid, JSON.stringify(ratings), JSON.stringify(openEnded));
    mirrorRow('session_feedback', {
      id: Number(sfInfo.lastInsertRowid),
      user_id: req.user.id, session_uuid: uuid,
      ratings, open: openEnded,
      submitted_at: new Date().toISOString(),
    });
    logEvent(req.user.id, 'survey_session', `uuid=${uuid}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
