import express, { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { jwtAuth } from '../middleware/jwtAuth';
import {
  getQuestions,
  getSchemaVersion,
  listScopes,
  validateAnswers
} from '../reviews/questionLoader';
import { validateBody } from '../middleware/validateBody';
import { reviewSubmitSchema } from '../validation/schemas';

const router = express.Router();

router.use(jwtAuth);

router.get('/schema', (req: Request, res: Response) => {
  const scope = String(req.query.scope || '');
  if (!scope) {
    res.json({
      scopes: listScopes(),
      version: getSchemaVersion()
    });
    return;
  }
  const questions = getQuestions(scope);
  if (!questions.length) {
    res.status(404).json({ error: 'unknown scope' });
    return;
  }
  res.json({
    scope,
    version: getSchemaVersion(),
    questions
  });
});

interface ReviewSubmitBody {
  scope: 'mid' | 'end';
  answers: Record<string, unknown>;
  analysisRunId?: string | number;
}

router.post('/', validateBody(reviewSubmitSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scope, analysisRunId, answers } = req.body as ReviewSubmitBody;

    const validation = validateAnswers(scope, answers || {});
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    let runId: number | null = null;
    if (analysisRunId !== undefined && analysisRunId !== null && analysisRunId !== '') {
      runId = Number(analysisRunId);
      if (!Number.isInteger(runId) || runId <= 0) {
        res.status(400).json({ error: 'analysisRunId must be a positive integer' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const owns = db.prepare(
        `SELECT id FROM analysis_runs WHERE id = ? AND user_id = ?`
      ).get(runId, req.user.id);
      if (!owns) {
        res.status(404).json({ error: 'analysis run not found' });
        return;
      }
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO reviews (user_id, scope, analysis_run_id, answers_json, schema_version, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    const info = stmt.run(
      req.user.id,
      scope,
      runId,
      JSON.stringify(validation.cleaned),
      getSchemaVersion()
    );

    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { next(err); }
});

export default router;
