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

const router = express.Router();

router.post('/consent', jwtAuth, validateBody(consentSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { version } = req.body as { version: string };
    db.prepare(
      `INSERT INTO survey_consent (user_id, accepted_at, version) VALUES (?, datetime('now'), ?)`
    ).run(req.user.id, version);
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
    db.prepare(
      `INSERT INTO survey_pretest (user_id, answers_json, submitted_at) VALUES (?, ?, datetime('now'))`
    ).run(req.user.id, JSON.stringify(answers));
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
    const runId = String(req.params.runId).slice(0, 128);
    const { ratings, openEnded } = req.body as {
      ratings: Record<string, number>;
      openEnded: Record<string, string>;
    };
    db.prepare(
      `INSERT INTO run_feedback (run_id, user_id, ratings_json, open_json, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(runId, req.user.id, JSON.stringify(ratings), JSON.stringify(openEnded));
    logEvent(req.user.id, 'survey_run', `runId=${runId}`);
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
    db.prepare(
      `INSERT INTO session_feedback (user_id, session_uuid, ratings_json, open_json, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(req.user.id, uuid, JSON.stringify(ratings), JSON.stringify(openEnded));
    logEvent(req.user.id, 'survey_session', `uuid=${uuid}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
