const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db/database');
const { analyzeClassDeclaration } = require('../services/classDeclarationAnalysisService');
const { generateDocumentation }   = require('../services/aiDocumentationService');
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

  const findingsCount = (analysis.findings || []).length;
  const info = stmt.run(
    sourceName,
    sourceText,
    JSON.stringify(analysis),
    artifactPath,
    0,
    0,
    findingsCount
  );

  return { id: info.lastInsertRowid, createdAt: new Date().toISOString() };
}

function buildPipelineFromMetrics(stageMetrics, detectedPatternsCount) {
  if (!Array.isArray(stageMetrics) || stageMetrics.length === 0) {
    return [
      { key: 'analysis',         title: 'Analysis',         state: 'waiting', summary: 'Awaiting microservice run.', detail: '' },
      { key: 'trees',            title: 'Trees',            state: 'waiting', summary: '',                          detail: '' },
      { key: 'pattern_dispatch', title: 'Pattern Dispatch', state: 'waiting', summary: '',                          detail: '' },
      { key: 'hashing',          title: 'Hashing',          state: 'waiting', summary: '',                          detail: '' },
      { key: 'output',           title: 'Output',           state: 'waiting', summary: '',                          detail: '' }
    ];
  }
  return stageMetrics.map(metric => ({
    key:     metric.stage_name,
    title:   metric.stage_name.charAt(0).toUpperCase() + metric.stage_name.slice(1),
    state:   'ready',
    summary: `${metric.items_processed || 0} item(s) in ${metric.milliseconds || 0} ms`,
    detail:  metric.stage_name === 'pattern_dispatch'
      ? `${detectedPatternsCount} pattern match(es) emitted.`
      : ''
  }));
}

function buildAnnotations(detectedPatterns, aiByPattern, sourceText) {
  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const annotations = [];
  let counter = 1;

  detectedPatterns.forEach((pattern, patternIndex) => {
    const aiResult = aiByPattern[patternIndex] || {};
    const aiDocs   = aiResult.documentationByTarget || {};
    const aiTests  = aiResult.unitTestPlanByTarget || {};

    (pattern.documentationTargets || []).forEach(anchor => {
      const lineText = anchor.line && anchor.line >= 1 && anchor.line <= lines.length
        ? (lines[anchor.line - 1] || '').trim()
        : '';
      annotations.push({
        id:       `comment-${counter}`,
        order:    counter++,
        stage:    'Pattern',
        severity: aiResult.verdict === 'reclassified' ? 'high' : 'medium',
        line:     anchor.line || null,
        lineEnd:  anchor.line || null,
        title:    `${pattern.patternName || pattern.patternId} :: ${anchor.label}`,
        comment:  aiDocs[anchor.label] || `Structural anchor "${anchor.label}" — AI documentation pending.`,
        excerpt:  lineText,
        kind:     anchor.label
      });
    });

    (pattern.unitTestTargets || []).forEach(target => {
      const lineText = target.line && target.line >= 1 && target.line <= lines.length
        ? (lines[target.line - 1] || '').trim()
        : '';
      const planKey = String(target.function_hash || '');
      annotations.push({
        id:       `comment-${counter}`,
        order:    counter++,
        stage:    'Test',
        severity: 'low',
        line:     target.line || null,
        lineEnd:  target.line || null,
        title:    `${pattern.patternName || pattern.patternId} :: ${target.function_name || target.branch_kind}`,
        comment:  aiTests[planKey]
          || `Unit-test target (${target.branch_kind}) — AI test plan pending.`,
        excerpt:  lineText,
        kind:     `unit_test:${target.branch_kind}`
      });
    });
  });

  if (!annotations.length) {
    annotations.push({
      id:       'comment-1',
      order:    1,
      stage:    'Review',
      severity: 'low',
      line:     1,
      lineEnd:  1,
      title:    'No structural patterns detected',
      comment:  'The microservice did not match any pattern in the catalog against this source.',
      excerpt:  (lines[0] || '').trim(),
      kind:     'no_match'
    });
  }

  return annotations;
}

function buildCommentedCode(sourceText, annotations) {
  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const groups = new Map();
  annotations.forEach(annotation => {
    const line = annotation.line || 1;
    if (!groups.has(line)) groups.set(line, []);
    groups.get(line).push(annotation);
  });
  const width = String(lines.length).length;
  const out = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const lineLabel  = String(lineNumber).padStart(width, ' ');
    out.push(`${lineLabel} | ${line}`);
    const comments = groups.get(lineNumber) || [];
    comments.forEach(c => {
      out.push(`  // [Comment ${c.order}] ${c.stage}: ${c.title} - ${c.comment}`);
    });
  });
  return out.join('\n');
}

function buildCommentsOnly(sourceName, annotations) {
  const out = [`# Comments for ${sourceName}`, '', `- Comment count: ${annotations.length}`, ''];
  annotations.forEach(a => {
    const lineRef = a.line ? `L${a.line}` : 'No line';
    out.push(`## Comment ${a.order}`);
    out.push(`- Stage: ${a.stage}`);
    out.push(`- Severity: ${a.severity}`);
    out.push(`- Anchor: ${lineRef}`);
    out.push(`- Title: ${a.title}`);
    out.push(`- Note: ${a.comment}`);
    if (a.excerpt) out.push(`- Excerpt: \`${a.excerpt}\``);
    out.push('');
  });
  return out.join('\n').trimEnd();
}

function buildDownloadFilename(sourceName, format) {
  const base = path.basename(sourceName, path.extname(sourceName)) || 'analysis';
  return format === 'comments-only' ? `${base}.comments.md` : `${base}.commented.cpp`;
}

function deriveAnnotations(analysis, sourceText) {
  if (Array.isArray(analysis.annotations) && analysis.annotations.length) {
    return analysis.annotations;
  }
  return buildAnnotations(
    analysis.detectedPatterns || [],
    analysis.aiByPattern      || [],
    sourceText
  );
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
        SELECT source_name, findings_count, created_at
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
    aiProviderConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    aiModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    totalRuns,
    latestRun
  });
});

router.get('/sample', (req, res) => {
  const samplePath = path.join(__dirname, '..', '..', 'uploads', 'sample.cpp');
  const fallbackProjectSample = path.join(
    __dirname, '..', '..', '..', '..',
    'Codebase', 'Microservice', 'samples', 'integration', 'all_patterns.cpp'
  );
  const sourcePath = fs.existsSync(samplePath) ? samplePath
                   : fs.existsSync(fallbackProjectSample) ? fallbackProjectSample
                   : null;
  if (!sourcePath) {
    return res.status(404).json({ error: 'No sample source available.' });
  }
  const code = fs.readFileSync(sourcePath, 'utf8');
  res.json({
    filename: path.basename(sourcePath),
    code
  });
});

router.post('/analyze', upload.single('file'), async (req, res, next) => {
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

    const structural = analyzeClassDeclaration({ sourceName, code: sourceText });

    const aiByPattern = await Promise.all(
      (structural.detectedPatterns || []).map(pattern =>
        generateDocumentation({
          detectedPattern:      pattern.patternId,
          language:             'cpp',
          className:            pattern.className,
          fileName:             pattern.fileName,
          classText:            pattern.classText,
          documentationTargets: pattern.documentationTargets,
          unitTestTargets:      pattern.unitTestTargets
        })
      )
    );

    const detectedPatterns = structural.detectedPatterns || [];
    const annotations = buildAnnotations(detectedPatterns, aiByPattern, sourceText);
    const pipeline = buildPipelineFromMetrics(structural.stageMetrics, detectedPatterns.length);

    const analysis = {
      sourceName,
      stage:               structural.stage,
      diagnostics:         structural.diagnostics || [],
      detectedPatterns,
      documentationTargets: structural.documentationTargets || [],
      unitTestTargets:      structural.unitTestTargets || [],
      aiByPattern,
      annotations,
      pipeline,
      stageMetrics:        structural.stageMetrics || [],
      microserviceArtifacts: structural.artifacts || {},
      microserviceRunDir:    structural.runDirectory || null,
      microserviceOutputDir: structural.outputDirectory || null,
      summary: `${sourceName}: ${detectedPatterns.length} pattern match(es), `
             + `${(structural.documentationTargets || []).length} documentation anchor(s), `
             + `${(structural.unitTestTargets || []).length} unit-test target(s).`,
      findings: structural.diagnostics || [],
      commentedCode: '',
      commentsOnly:  '',
      transformedPreview: ''
    };

    analysis.commentedCode      = buildCommentedCode(sourceText, annotations);
    analysis.commentsOnly       = buildCommentsOnly(sourceName, annotations);
    analysis.transformedPreview = analysis.commentedCode.slice(0, 1500);

    const artifactName = `${path.basename(sourceName, path.extname(sourceName)) || 'analysis'}-${Date.now()}.json`;
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    const artifactPath = path.join(outputsDir, artifactName);
    fs.writeFileSync(artifactPath, JSON.stringify(analysis, null, 2), 'utf8');

    const run = saveRun({ sourceName, sourceText, analysis, artifactPath });

    if (req.file) fs.unlink(req.file.path, () => {});

    logEvent(null, 'analysis', `Analyzed source via microservice: ${sourceName}`);

    res.status(201).json({
      runId:         run.id,
      createdAt:     run.createdAt,
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
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const analysis = JSON.parse(run.analysis_json);
    res.json({
      id:          run.id,
      sourceName:  run.source_name,
      sourceText:  run.source_text,
      analysis: {
        ...analysis,
        annotations: deriveAnnotations(analysis, run.source_text)
      },
      artifactPath: run.artifact_path,
      createdAt:    run.created_at
    });
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/artifact', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (!fs.existsSync(run.artifact_path)) return res.status(404).json({ error: 'Artifact missing' });
    res.download(run.artifact_path);
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/export', (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ?').get(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const analysis = JSON.parse(run.analysis_json);
    const annotations = deriveAnnotations(analysis, run.source_text);
    const format = req.query.format === 'comments-only' ? 'comments-only' : 'commented-code';
    const payload = format === 'comments-only'
      ? buildCommentsOnly(run.source_name, annotations)
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
