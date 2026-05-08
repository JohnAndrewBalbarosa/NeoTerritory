import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import { validateBody } from '../middleware/validateBody';
import {
  consentSchema,
  pretestSchema,
  runFeedbackSchema,
  sessionFeedbackSchema
} from '../validation/schemas';
import { logEvent } from '../services/logService';
import { mirrorRow } from '../services/supabaseLogger';

const router = express.Router();

router.post('/consent', jwtAuth, validateBody(consentSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { version } = req.body as { version: string };
    const cInfo = db.prepare(
      `INSERT INTO survey_consent (user_id, accepted_at, version) VALUES (?, datetime('now'), ?)`
    ).run(req.user.id, version);
    const acceptedAt = new Date().toISOString();
    mirrorRow('survey_consent', {
      id: Number(cInfo.lastInsertRowid),
      user_id: req.user.id, accepted_at: acceptedAt, version,
    });
    logEvent(req.user.id, 'survey_consent', `version=${version}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/pretest', jwtAuth, validateBody(pretestSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { answers } = req.body as { answers: Record<string, unknown> };
    const pInfo = db.prepare(
      `INSERT INTO survey_pretest (user_id, answers_json, submitted_at) VALUES (?, ?, datetime('now'))`
    ).run(req.user.id, JSON.stringify(answers));
    mirrorRow('survey_pretest', {
      id: Number(pInfo.lastInsertRowid),
      user_id: req.user.id, answers,
      submitted_at: new Date().toISOString(),
    });
    logEvent(req.user.id, 'survey_pretest', `keys=${Object.keys(answers).length}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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
    const { ratings, openEnded } = req.body as {
      ratings: Record<string, number>;
      openEnded: Record<string, string>;
    };
    const rfInfo = db.prepare(
      `INSERT INTO run_feedback (run_id, user_id, ratings_json, open_json, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(runIdNum, req.user.id, JSON.stringify(ratings), JSON.stringify(openEnded));
    mirrorRow('run_feedback', {
      id: Number(rfInfo.lastInsertRowid),
      run_id: runIdNum, user_id: req.user.id,
      ratings, open: openEnded,
      submitted_at: new Date().toISOString(),
    });
    logEvent(req.user.id, 'survey_run', `runId=${runIdNum}`);
    res.status(201).json({ ok: true });
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
