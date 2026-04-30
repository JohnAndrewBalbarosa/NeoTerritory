const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');

const SERVER_STARTED_AT = new Date().toISOString();
const db = require('../db/database');
const { analyzeClassDeclaration, resolveBinaryPath, resolveCatalogPath } = require('../services/classDeclarationAnalysisService');
const { generateDocumentation, getPlannerStatus } = require('../services/aiDocumentationService');
const { rankAll }                  = require('../services/patternRankingService');
const { bindAll: bindClassUsages } = require('../services/classUsageBinder');
const { logEvent } = require('../services/logService');
const { jwtAuth } = require('../middleware/jwtAuth');
const { getSetting } = require('./settings');

const router = express.Router();

// Ephemeral cache for unsaved analysis results.
// Keyed by uuid; entries auto-expire after 10 minutes.
const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingRuns = new Map();
function stashPending(payload) {
  const id = `pen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  pendingRuns.set(id, { ...payload, expiresAt: Date.now() + PENDING_TTL_MS });
  return id;
}
function takePending(id, userId) {
  const entry = pendingRuns.get(id);
  if (!entry) return null;
  pendingRuns.delete(id);
  if (entry.expiresAt < Date.now()) return null;
  if (entry.userId && userId && entry.userId !== userId) return null;
  return entry;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingRuns) if (v.expiresAt < now) pendingRuns.delete(k);
}, 60 * 1000).unref();

function safeUsername(name) {
  return String(name || 'anon').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'anon';
}
const testRoot = process.env.TEST_RESULTS_DIR
  || path.join(__dirname, '..', '..', '..', '..', 'test');
const uploadsDir = path.join(testRoot, '_uploads');
// Per-user output folders live directly inside testRoot (e.g. test/devcon1/).
const outputsDir = testRoot;

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

function saveRun({ sourceName, sourceText, analysis, artifactPath, userId }) {
  ensureAnalysisTable();
  const stmt = db.prepare(`INSERT INTO analysis_runs (
    source_name,
    source_text,
    analysis_json,
    artifact_path,
    structure_score,
    modernization_score,
    findings_count,
    created_at,
    user_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`);

  const findingsCount = (analysis.findings || []).length;
  const info = stmt.run(
    sourceName,
    sourceText,
    JSON.stringify(analysis),
    artifactPath,
    0,
    0,
    findingsCount,
    userId || null
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

/**
 * Per-class scope coherence (user request, post-v3):
 *   "kung ano yung confident na design pattern para sa buong class, ganun
 *    rin dapat sa children class, magkakaroon lamang ng tie kapag may
 *    design pattern na kung saan buong class ay kaparehas na kaparehas"
 *
 * Within one class, every annotation should reflect that class's winning
 * pattern. Runner-up patterns that detected the same class shape do NOT
 * emit annotations — unless they are genuinely tied with the winner
 * (within ranker AMBIGUITY_DELTA), in which case both surface.
 *
 * Returns a set of `${patternId}::${className}` keys that ARE allowed
 * to emit annotations. If `ranking` is null (no rank pass ran), every
 * detection is allowed (legacy behavior).
 */
function buildAllowedScopeKeys(detectedPatterns, ranking) {
  if (!ranking || !Array.isArray(ranking.ranks)) {
    return new Set((detectedPatterns || []).map(p => `${p.patternId}::${p.className}`));
  }
  const AMBIGUITY_DELTA = (ranking.thresholds && ranking.thresholds.ambiguityDelta) || 0.10;
  const byClass = new Map();
  for (const r of ranking.ranks) {
    const cls = r.className || '__nameless__';
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls).push(r);
  }
  const allowed = new Set();
  for (const [cls, list] of byClass) {
    list.sort((a, b) => b.finalRank - a.finalRank);
    const top = list[0];
    if (!top) continue;
    allowed.add(`${top.patternId}::${cls}`);
    // Genuine tie: another pattern within AMBIGUITY_DELTA of the leader.
    for (let i = 1; i < list.length; i += 1) {
      if (top.finalRank - list[i].finalRank <= AMBIGUITY_DELTA) {
        allowed.add(`${list[i].patternId}::${cls}`);
      }
    }
  }
  return allowed;
}

function buildAnnotations(detectedPatterns, aiByPattern, sourceText, ranking) {
  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const annotations = [];
  let counter = 1;

  const allowedScopeKeys = buildAllowedScopeKeys(detectedPatterns, ranking);

  detectedPatterns.forEach((pattern, patternIndex) => {
    // Per-class scope coherence: skip non-winning patterns on this class.
    if (!allowedScopeKeys.has(`${pattern.patternId}::${pattern.className}`)) return;

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
        // Manual-first copy: never surface "AI pending" wording. When AI text
        // is present, use it; otherwise leave the comment empty so the popover
        // can render the manual "Add documentation for this scope" affordance.
        comment:  aiDocs[anchor.label] || '',
        excerpt:  lineText,
        kind:     anchor.label,
        patternId: pattern.patternId,
        anchorLabel: anchor.label,
        scopeKey: `${pattern.patternId}::${pattern.className}::${anchor.label}`
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
        // Manual-first copy: empty when no AI text, popover shows the "Add unit-test plan" affordance.
        comment:  aiTests[planKey] || '',
        excerpt:  lineText,
        kind:     `unit_test:${target.branch_kind}`,
        patternId: pattern.patternId,
        scopeKey:  `${pattern.patternId}::${pattern.className}::test::${target.branch_kind}::${target.function_name || ''}::L${target.line || 0}`
      });
    });
  });

  // Note: when zero patterns are detected we DO NOT push a fake line-1 annotation.
  // The frontend reads `analysis.noPatternsDetected` and renders a single banner
  // outside the source view (criterion: no false "No pattern found" markers next
  // to actual lines of code).

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
    sourceText,
    analysis.ranking || null
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

  const binaryPath = resolveBinaryPath();
  const catalogPath = resolveCatalogPath();
  const microservice = {
    binaryPath,
    catalogPath,
    binaryFound: fs.existsSync(binaryPath),
    catalogFound: fs.existsSync(catalogPath)
  };
  microservice.connected = microservice.binaryFound && microservice.catalogFound;

  res.json({
    status: 'ok',
    service: 'NeoTerritory analysis api',
    mode: db.mode || (process.env.NEOTERRITORY_MODE || 'tester').toLowerCase(),
    aiProvider: getPlannerStatus().provider,
    aiProviderConfigured: getPlannerStatus().configured,
    aiModel: getPlannerStatus().model,
    microservice,
    totalRuns,
    latestRun,
    process: {
      pid: process.pid,
      hostname: os.hostname(),
      port: Number(process.env.PORT) || 3001,
      startedAt: SERVER_STARTED_AT
    }
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

async function runAnalysisPipeline(sourceName, sourceText) {
  const t0 = Date.now();
  const structural = analyzeClassDeclaration({ sourceName, code: sourceText });
  const tStructural = Date.now() - t0;

  const detectedPatterns = structural.detectedPatterns || [];

  const aiEnabled = getSetting('ai_enabled', '1') !== '0';

  const t1 = Date.now();
  const [aiByPattern, ranking, classUsageBindings] = await Promise.all([
    aiEnabled
      ? Promise.all(detectedPatterns.map(pattern =>
          generateDocumentation({
            detectedPattern:      pattern.patternId,
            language:             'cpp',
            className:            pattern.className,
            fileName:             pattern.fileName,
            classText:            pattern.classText,
            documentationTargets: pattern.documentationTargets,
            unitTestTargets:      pattern.unitTestTargets
          })
        ))
      : Promise.resolve([]),
    Promise.resolve(rankAll(detectedPatterns, sourceText)),
    Promise.resolve(bindClassUsages(sourceText, detectedPatterns))
  ]);
  const tParallel = Date.now() - t1;

  const t2 = Date.now();
  const annotations = buildAnnotations(detectedPatterns, aiByPattern, sourceText, ranking);
  const tAnnotations = Date.now() - t2;

  const _timing = {
    structuralMs:  tStructural,
    parallelMs:    tParallel,
    annotationsMs: tAnnotations,
    totalMs:       Date.now() - t0
  };

  return { structural, detectedPatterns, aiByPattern, ranking, classUsageBindings, annotations, _timing, aiEnabled };
}

if (process.env.NODE_ENV !== 'production') {
  router.get('/timing-report', async (req, res, next) => {
    try {
      const samplePath = path.join(__dirname, '..', '..', 'uploads', 'sample.cpp');
      const fallbackSample = path.join(
        __dirname, '..', '..', '..', '..',
        'Codebase', 'Microservice', 'samples', 'integration', 'all_patterns.cpp'
      );
      const sourcePath = fs.existsSync(samplePath) ? samplePath
                       : fs.existsSync(fallbackSample) ? fallbackSample
                       : null;
      if (!sourcePath) return res.status(404).json({ error: 'No sample file available.' });

      const code = fs.readFileSync(sourcePath, 'utf8');
      const filename = path.basename(sourcePath);
      const { _timing, detectedPatterns, aiByPattern } = await runAnalysisPipeline(filename, code);

      res.json({
        sample: filename,
        patternsFound: detectedPatterns.length,
        aiCallCount: aiByPattern.length,
        timing: _timing,
        breakdown: [
          `structural (C++ microservice): ${_timing.structuralMs}ms`,
          `parallel (AI docs + ranking + binding): ${_timing.parallelMs}ms`,
          `  └─ AI calls: ${aiByPattern.length} concurrent Gemini requests`,
          `annotations build: ${_timing.annotationsMs}ms`,
          `total: ${_timing.totalMs}ms`
        ]
      });
    } catch (err) {
      next(err);
    }
  });
}

function buildSuspectedStructures(detectedPatterns, ranking) {
  return (ranking.winners || []).map(w => {
    const det = detectedPatterns.find(p =>
      p.patternId === w.patternId && p.className === w.className) || {};
    return {
      className:         w.className,
      patternId:         w.patternId,
      patternName:       det.patternName || w.patternId,
      patternFamily:     det.patternFamily || (w.patternId.split('.')[0] || ''),
      finalRank:         w.finalRank,
      implementationFit: w.implementationFit,
      evidence:          w.evidence,
      rivals:            ranking.perClassRivals[w.className] || []
    };
  });
}

// Streams analysis results as Server-Sent Events so the frontend can render
// each stage (structural, ranking, binding, AI per pattern) the moment it's ready.
router.post('/analyze', jwtAuth, upload.single('file'), async (req, res) => {
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

  // Switch to SSE — headers must be set before first write.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (evt, data) => {
    res.write(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ── Stage 1: C++ microservice (synchronous spawn) ──────────────────────
    const t0 = Date.now();
    const structural = analyzeClassDeclaration({ sourceName, code: sourceText });
    const tStructural = Date.now() - t0;
    const detectedPatterns = structural.detectedPatterns || [];

    send('structural', {
      sourceName,
      sourceText,
      stage:               structural.stage,
      diagnostics:         structural.diagnostics || [],
      detectedPatterns,
      documentationTargets: structural.documentationTargets || [],
      unitTestTargets:      structural.unitTestTargets || [],
      stageMetrics:        structural.stageMetrics || [],
      noPatternsDetected:  detectedPatterns.length === 0
    });

    // ── Stage 2a: ranking (synchronous, <10ms) ─────────────────────────────
    const aiEnabled = getSetting('ai_enabled', '1') !== '0';
    const t1 = Date.now();

    const ranking = rankAll(detectedPatterns, sourceText);
    send('ranking', ranking);

    // ── Stage 2b: class usage binding (synchronous, <10ms) ────────────────
    const classUsageBindings = bindClassUsages(sourceText, detectedPatterns);
    send('binding', { classUsageBindings });

    // ── Stage 2c: AI commentary (async, one event per pattern) ───────────
    const aiByPattern = new Array(detectedPatterns.length).fill(null);
    const aiPromises = aiEnabled
      ? detectedPatterns.map((pattern, i) =>
          generateDocumentation({
            detectedPattern:      pattern.patternId,
            language:             'cpp',
            className:            pattern.className,
            fileName:             pattern.fileName,
            classText:            pattern.classText,
            documentationTargets: pattern.documentationTargets,
            unitTestTargets:      pattern.unitTestTargets
          }).then(result => {
            aiByPattern[i] = result;
            send('ai_item', {
              index:     i,
              patternId: pattern.patternId,
              className: pattern.className,
              result
            });
            return result;
          })
        )
      : [];

    await Promise.all(aiPromises);
    const tParallel = Date.now() - t1;

    // ── Stage 3: build final annotations (needs all AI results) ───────────
    const t2 = Date.now();
    const annotations = buildAnnotations(detectedPatterns, aiByPattern, sourceText, ranking);
    const tAnnotations = Date.now() - t2;

    const suspectedStructures = buildSuspectedStructures(detectedPatterns, ranking);
    const pipeline = buildPipelineFromMetrics(structural.stageMetrics, detectedPatterns.length);
    const aiAvailable = aiEnabled && getPlannerStatus().configured;

    const _timing = {
      structuralMs:  tStructural,
      parallelMs:    tParallel,
      annotationsMs: tAnnotations,
      totalMs:       Date.now() - t0
    };

    const analysis = {
      sourceName,
      stage:               structural.stage,
      diagnostics:         structural.diagnostics || [],
      detectedPatterns,
      noPatternsDetected:  detectedPatterns.length === 0,
      suspectedStructures,
      documentationTargets: structural.documentationTargets || [],
      unitTestTargets:      structural.unitTestTargets || [],
      aiByPattern,
      aiAvailable,
      ranking,
      classUsageBindings,
      classUsageBindingSource: 'heuristic',
      annotations,
      pipeline,
      stageMetrics:        structural.stageMetrics || [],
      _timing,
      summary: `${sourceName}: ${detectedPatterns.length} pattern match(es), `
             + `${suspectedStructures.length} suspected structure(s), `
             + `${(structural.documentationTargets || []).length} documentation anchor(s), `
             + `${(structural.unitTestTargets || []).length} unit-test target(s).`,
      findings: structural.diagnostics || [],
    };
    analysis.commentedCode      = buildCommentedCode(sourceText, annotations);
    analysis.commentsOnly       = buildCommentsOnly(sourceName, annotations);
    analysis.transformedPreview = analysis.commentedCode.slice(0, 1500);

    if (req.file) fs.unlink(req.file.path, () => {});

    const pendingId = stashPending({
      sourceName, sourceText, analysis, userId: req.user && req.user.id
    });
    logEvent(req.user && req.user.id, 'analysis', `Analyzed (unsaved): ${sourceName}`);

    send('complete', {
      pendingId,
      annotations,
      suspectedStructures,
      ranking,
      aiByPattern,
      aiAvailable,
      summary: analysis.summary,
      _timing
    });

    res.end();
  } catch (err) {
    try {
      send('error', { error: err.message || String(err) });
      res.end();
    } catch { /* stream already closed */ }
  }
});

router.post('/runs/save', jwtAuth, (req, res, next) => {
  try {
    const { pendingId, userResolvedPattern } = req.body || {};
    if (!pendingId) return res.status(400).json({ error: 'pendingId required' });
    const pending = takePending(pendingId, req.user && req.user.id);
    if (!pending) return res.status(404).json({ error: 'Pending run not found or expired' });
    if (userResolvedPattern && typeof userResolvedPattern === 'string') {
      pending.analysis.userResolvedPattern = userResolvedPattern;
    }

    const userDirName = safeUsername(req.user && req.user.username);
    const userOutputsDir = path.join(outputsDir, userDirName);
    if (!fs.existsSync(userOutputsDir)) fs.mkdirSync(userOutputsDir, { recursive: true });
    const artifactName = `${path.basename(pending.sourceName, path.extname(pending.sourceName)) || 'analysis'}-${Date.now()}.json`;
    const artifactPath = path.join(userOutputsDir, artifactName);
    fs.writeFileSync(artifactPath, JSON.stringify(pending.analysis, null, 2), 'utf8');

    const run = saveRun({
      sourceName: pending.sourceName,
      sourceText: pending.sourceText,
      analysis:   pending.analysis,
      artifactPath,
      userId:     req.user && req.user.id
    });

    logEvent(req.user && req.user.id, 'save', `Saved run: ${pending.sourceName}`);

    res.status(201).json({
      saved: true,
      runId: run.id,
      createdAt: run.createdAt,
      artifactPath
    });
  } catch (err) {
    next(err);
  }
});

router.get('/runs', jwtAuth, (req, res, next) => {
  try {
    ensureAnalysisTable();
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const rows = db.prepare(`
      SELECT id, source_name, structure_score, modernization_score, findings_count, created_at
      FROM analysis_runs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(req.user.id, limit);
    res.json({ runs: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id', jwtAuth, (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
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

router.get('/runs/:id/artifact', jwtAuth, (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (!fs.existsSync(run.artifact_path)) return res.status(404).json({ error: 'Artifact missing' });
    res.download(run.artifact_path);
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/export', jwtAuth, (req, res, next) => {
  try {
    ensureAnalysisTable();
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
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
