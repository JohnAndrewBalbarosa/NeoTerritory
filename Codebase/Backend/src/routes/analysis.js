const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db/database');
const {
  analyzeSource,
  writeAnalysisArtifact,
  buildCommentedCode,
  buildCommentsOnly,
  buildDownloadFilename
} = require('../services/analyzer');
const { logEvent } = require('../services/logService');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const outputsDir = path.join(__dirname, '..', '..', 'outputs');

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 2 * 1024 * 1024 }
});

function ensureAnalysisTable() {
  db.prepare(`CREATE TABLE IF NOT EXISTS analysis_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    structure_score INTEGER NOT NULL,
    modernization_score INTEGER NOT NULL,
    findings_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
}

function saveRun({ sourceName, sourceText, analysis, artifactPath }) {
  ensureAnalysisTable();
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO analysis_runs (
    source_name,
    source_text,
    analysis_json,
    artifact_path,
    structure_score,
    modernization_score,
    findings_count,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`);

  const info = stmt.run(
    sourceName,
    sourceText,
    JSON.stringify(analysis),
    artifactPath,
    analysis.structureScore,
    analysis.modernizationScore,
    analysis.findings.length
  );

  return { id: info.lastInsertRowid, createdAt };
}

function deriveAnnotations(analysis, sourceText) {
  if (Array.isArray(analysis.annotations) && analysis.annotations.length) {
    return analysis.annotations;
  }

  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  return (analysis.findings || []).map((finding, index) => ({
    id: `comment-${index + 1}`,
    order: index + 1,
    stage: 'Finding',
    severity: finding.severity || 'low',
    line: finding.line || null,
    lineEnd: finding.line || null,
    title: finding.title || 'Finding',
    comment: finding.detail || '',
    excerpt: finding.line ? (lines[finding.line - 1] || '').trim() : '',
    kind: finding.rule || 'finding'
  }));
}

router.get('/health', (req, res) => {
  const totalRuns = (() => {
    try {
      ensureAnalysisTable();
      return db.prepare('SELECT COUNT(*) AS count FROM analysis_runs').get().count;
    } catch {
      return 0;
    }
  })();

  const latestRun = (() => {
    try {
      ensureAnalysisTable();
      return db.prepare(`
        SELECT source_name, structure_score, modernization_score, findings_count, created_at
        FROM analysis_runs
        ORDER BY id DESC
        LIMIT 1
      `).get() || null;
    } catch {
      return null;
    }
  })();

  res.json({
    status: 'ok',
    service: 'NeoTerritory analysis api',
    totalRuns,
    latestRun
  });
});

router.get('/sample', (req, res) => {
  const samplePath = path.join(__dirname, '..', 'uploads', 'sample.cpp');
  const fallbackPath = path.join(__dirname, '..', '..', 'uploads', 'sample.cpp');
  const sourcePath = fs.existsSync(samplePath) ? samplePath : fallbackPath;
  const code = fs.readFileSync(sourcePath, 'utf8');
  res.json({
    filename: path.basename(sourcePath),
    code
  });
});

router.post('/analyze', upload.single('file'), (req, res, next) => {
  try {
    const codeFromBody = typeof req.body.code === 'string' ? req.body.code : '';
    const filenameFromBody = typeof req.body.filename === 'string' && req.body.filename.trim()
      ? req.body.filename.trim()
      : 'snippet.cpp';

    let sourceName = filenameFromBody;
    let sourceText = codeFromBody;

    if (req.file) {
      sourceName = req.file.originalname;
      sourceText = fs.readFileSync(req.file.path, 'utf8');
    }

    if (!sourceText.trim()) {
      return res.status(400).json({ error: 'Provide a file or source code text.' });
    }

    const analysis = analyzeSource({ sourceName, code: sourceText });
    const artifactPath = writeAnalysisArtifact({ outputsDir, sourceName, analysis });
    const run = saveRun({ sourceName, sourceText, analysis, artifactPath });

    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    logEvent(null, 'analysis', `Analyzed source: ${sourceName}`);

    res.status(201).json({
      runId: run.id,
      createdAt: run.createdAt,
      sourceName,
      sourceText,
      artifactPath,
      ...analysis
    });
  } catch (err) {
    next(err);
  }
});

router.get('/runs', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const rows = db.prepare(`
      SELECT id, source_name, structure_score, modernization_score, findings_count, created_at
      FROM analysis_runs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    res.json({ runs: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const analysis = JSON.parse(run.analysis_json);
    res.json({
      id: run.id,
      sourceName: run.source_name,
      sourceText: run.source_text,
      analysis: {
        ...analysis,
        annotations: deriveAnnotations(analysis, run.source_text)
      },
      artifactPath: run.artifact_path,
      createdAt: run.created_at
    });
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/artifact', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    if (!fs.existsSync(run.artifact_path)) {
      return res.status(404).json({ error: 'Artifact missing' });
    }
    res.download(run.artifact_path);
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/export', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const analysis = JSON.parse(run.analysis_json);
    const format = req.query.format === 'comments-only' ? 'comments-only' : 'commented-code';
    const annotations = deriveAnnotations(analysis, run.source_text);
    const payload = format === 'comments-only'
      ? buildCommentsOnly({
          sourceName: run.source_name,
          annotations,
          analysis
        })
      : buildCommentedCode(run.source_text, annotations);
    const filename = buildDownloadFilename(run.source_name, format);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.type(format === 'comments-only' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
    res.send(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
