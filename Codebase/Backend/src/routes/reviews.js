const express = require('express');
const db = require('../db/database');
const { jwtAuth } = require('../middleware/jwtAuth');
const {
  getQuestions,
  getSchemaVersion,
  listScopes,
  validateAnswers
} = require('../reviews/questionLoader');

const router = express.Router();

router.use(jwtAuth);

router.get('/schema', (req, res) => {
  const scope = String(req.query.scope || '');
  if (!scope) {
    return res.json({
      scopes: listScopes(),
      version: getSchemaVersion()
    });
  }
  const questions = getQuestions(scope);
  if (!questions.length) {
    return res.status(404).json({ error: 'unknown scope' });
  }
  res.json({
    scope,
    version: getSchemaVersion(),
    questions
  });
});

router.post('/', (req, res, next) => {
  try {
    const { scope, analysisRunId, answers } = req.body || {};
    if (!scope) return res.status(400).json({ error: 'scope required' });

    const validation = validateAnswers(scope, answers || {});
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    let runId = null;
    if (analysisRunId !== undefined && analysisRunId !== null && analysisRunId !== '') {
      runId = Number(analysisRunId);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ error: 'analysisRunId must be a positive integer' });
      }
      const owns = db.prepare(
        `SELECT id FROM analysis_runs WHERE id = ? AND user_id = ?`
      ).get(runId, req.user.id);
      if (!owns) {
        return res.status(404).json({ error: 'analysis run not found' });
      }
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

module.exports = router;
