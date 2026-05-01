import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';

const SERVER_STARTED_AT = new Date().toISOString();
import db from '../db/database';
import {
  analyzeClassDeclaration,
  resolveBinaryPath,
  resolveCatalogPath,
  AnalysisResult,
  DetectedPatternResult
} from '../services/classDeclarationAnalysisService';
import { generateDocumentation, AiResult } from '../services/aiDocumentationService';
import { rankAll } from '../services/patternRankingService';
import { bindAll as bindClassUsages } from '../services/classUsageBinder';
import { logEvent } from '../services/logService';
import { jwtAuth } from '../middleware/jwtAuth';
import { validateBody } from '../middleware/validateBody';
import { analyzeBodySchema, saveRunSchema, filenameSchema } from '../validation/schemas';
import { uploadsDir, outputsDir } from '../config/paths';

interface AnalysisPayload {
  sourceName: string;
  stage: string;
  diagnostics: unknown[];
  detectedPatterns: DetectedPatternResult[];
  documentationTargets: unknown[];
  unitTestTargets: unknown[];
  aiByPattern: AiResult[];
  ranking: ReturnType<typeof rankAll>;
  classUsageBindings: Record<string, unknown[]>;
  classUsageBindingSource: string;
  annotations: AnnotationOut[];
  pipeline: PipelineStageOut[];
  stageMetrics: unknown[];
  microserviceArtifacts: Record<string, unknown>;
  microserviceRunDir: string | null;
  microserviceOutputDir: string | null;
  summary: string;
  findings: unknown[];
  commentedCode: string;
  commentsOnly: string;
  transformedPreview: string;
  userResolvedPattern?: string;
}

interface PendingEntry {
  sourceName: string;
  sourceText: string;
  analysis: AnalysisPayload;
  userId?: number;
  expiresAt: number;
}

interface PipelineStageOut {
  key: string;
  title: string;
  state: 'waiting' | 'ready' | 'error';
  summary: string;
  detail: string;
}

interface PatternLexemeSet {
  keywords: string[];
  methods:  string[];
  idioms:   string[];
}

interface AnnotationOut {
  id: string;
  order: number;
  stage: string;
  severity: 'high' | 'medium' | 'low';
  line: number | null;
  lineEnd: number | null;
  title: string;
  comment: string;
  excerpt: string;
  kind: string;
  patternKey?: string;
  className?: string;
  lexemeHints?: string[];
}

const PATTERN_LEXEMES: Record<string, PatternLexemeSet> = {
  factory:        { keywords: ['virtual', 'new', 'override'],        methods: ['create', 'make', 'build', 'produce', 'newInstance'],       idioms: ['return new', 'Product*', 'polymorphic construction'] },
  singleton:      { keywords: ['static'],                            methods: ['getInstance', 'instance', 'sharedInstance'],               idioms: ['= delete', 'private constructor', 'static local variable'] },
  builder:        { keywords: ['return'],                            methods: ['set', 'with', 'add', 'build', 'construct', 'reset'],       idioms: ['return *this', 'method chaining', 'fluent interface'] },
  methodchaining: { keywords: ['return'],                            methods: ['set', 'with', 'add', 'enable', 'disable', 'configure'],    idioms: ['return *this', 'fluent API', 'return self'] },
  adapter:        { keywords: ['override', 'virtual'],               methods: ['adapt', 'convert', 'wrap', 'translate', 'delegate'],       idioms: ['adaptee_', 'composition', 'interface bridging'] },
  decorator:      { keywords: ['override', 'virtual'],               methods: ['decorate', 'wrap', 'augment', 'enhance'],                  idioms: ['wrappee_', 'component_', 'forward call', 'pointer to base'] },
  proxy:          { keywords: ['override', 'virtual'],               methods: ['request', 'access', 'get', 'load', 'check'],              idioms: ['realSubject_', 'lazy initialization', 'access control'] },
  strategy:       { keywords: ['virtual', 'override'],               methods: ['execute', 'perform', 'apply', 'run', 'sort', 'validate'],  idioms: ['strategy_', 'setStrategy', 'algorithm family'] },
  observer:       { keywords: ['virtual', 'override'],               methods: ['update', 'notify', 'subscribe', 'attach', 'detach'],       idioms: ['observers_', 'notify()', 'event subscription'] },
  composite:      { keywords: ['virtual', 'override'],               methods: ['add', 'remove', 'getChild', 'operation', 'display'],       idioms: ['children_', 'leaf', 'recursive operation'] },
  iterator:       { keywords: ['override'],                          methods: ['next', 'hasNext', 'current', 'begin', 'end', 'reset'],     idioms: ['index_', 'current_', 'operator++', 'collection traversal'] },
  visitor:        { keywords: ['virtual', 'override'],               methods: ['visit', 'accept'],                                         idioms: ['double dispatch', 'accept(visitor)', 'visitConcreteA'] },
  command:        { keywords: ['virtual', 'override'],               methods: ['execute', 'undo', 'redo', 'perform'],                      idioms: ['receiver_', 'invoker_', 'action encapsulation'] },
  pimpl:          { keywords: ['unique_ptr', 'forward'],             methods: ['impl_', 'd_ptr'],                                          idioms: ['struct Impl', 'unique_ptr<Impl>', 'opaque pointer'] },
};

function lexemesForPattern(patternName: string): PatternLexemeSet | null {
  const normalized = (patternName || '').toLowerCase();
  const fullKey = normalized.replace(/[^a-z]/g, '');
  if (PATTERN_LEXEMES[fullKey]) return PATTERN_LEXEMES[fullKey];
  const head = normalized.split(/[^a-z]+/).filter(Boolean)[0];
  if (head && PATTERN_LEXEMES[head]) return PATTERN_LEXEMES[head];
  return null;
}

// Conditional validator: skip when request is multipart (Multer handles upload).
function maybeValidateAnalyzeBody(req: Request, res: Response, next: NextFunction): void {
  if (req.is('multipart/*')) {
    next();
    return;
  }
  validateBody(analyzeBodySchema)(req, res, next);
}

const router = express.Router();

// Ephemeral cache for unsaved analysis results.
const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingRuns = new Map<string, PendingEntry>();

// Ephemeral AI commentary jobs spawned alongside structural analysis.
interface AiJobEntry {
  status: 'pending' | 'ready' | 'failed';
  annotations?: AnnotationOut[];
  error?: string;
  expiresAt: number;
}
const AI_JOB_TTL_MS = 10 * 60 * 1000;
const aiJobs = new Map<string, AiJobEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of aiJobs) if (v.expiresAt < now) aiJobs.delete(k);
}, 60 * 1000).unref();

function aiCommenterEnabled(): boolean {
  const flag = process.env.AI_COMMENTER_ENABLED;
  if (flag === undefined) return true;
  return !/^(false|0|no|off)$/i.test(flag.trim());
}

function newAiJobId(): string {
  return `aij_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stashPending(payload: Omit<PendingEntry, 'expiresAt'>): string {
  const id = `pen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  pendingRuns.set(id, { ...payload, expiresAt: Date.now() + PENDING_TTL_MS });
  return id;
}

function takePending(id: string, userId: number | undefined): PendingEntry | null {
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

function safeUsername(name: string | undefined): string {
  return String(name || 'anon').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'anon';
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 2 * 1024 * 1024 }
});

interface SaveRunInput {
  sourceName: string;
  sourceText: string;
  analysis: AnalysisPayload;
  artifactPath: string;
  userId?: number;
}

function saveRun(input: SaveRunInput): { id: number | bigint; createdAt: string } {
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

  const findingsCount = (input.analysis.findings || []).length;
  const info = stmt.run(
    input.sourceName,
    input.sourceText,
    JSON.stringify(input.analysis),
    input.artifactPath,
    0,
    0,
    findingsCount,
    input.userId || null
  );

  return { id: info.lastInsertRowid as number | bigint, createdAt: new Date().toISOString() };
}

interface StageMetric {
  stage_name: string;
  items_processed?: number;
  milliseconds?: number;
}

function buildPipelineFromMetrics(stageMetrics: StageMetric[] | undefined, detectedPatternsCount: number): PipelineStageOut[] {
  if (!Array.isArray(stageMetrics) || stageMetrics.length === 0) {
    return [
      { key: 'analysis',         title: 'Analysis',         state: 'waiting', summary: 'Awaiting microservice run.', detail: '' },
      { key: 'trees',            title: 'Trees',            state: 'waiting', summary: '',                          detail: '' },
      { key: 'pattern_dispatch', title: 'Pattern Dispatch', state: 'waiting', summary: '',                          detail: '' },
      { key: 'hashing',          title: 'Hashing',          state: 'waiting', summary: '',                          detail: '' },
      { key: 'output',           title: 'Output',           state: 'waiting', summary: '',                          detail: '' }
    ];
  }
  return stageMetrics.map((metric) => ({
    key:     metric.stage_name,
    title:   metric.stage_name.charAt(0).toUpperCase() + metric.stage_name.slice(1),
    state:   'ready',
    summary: `${metric.items_processed || 0} item(s) in ${metric.milliseconds || 0} ms`,
    detail:  metric.stage_name === 'pattern_dispatch'
      ? `${detectedPatternsCount} pattern match(es) emitted.`
      : ''
  }));
}

function buildStructuralAnnotations(detectedPatterns: DetectedPatternResult[], sourceText: string): AnnotationOut[] {
  const emptyAi: AiResult[] = detectedPatterns.map(() => ({
    status: 'skipped',
    documentationByTarget: {},
    unitTestPlanByTarget: {}
  }));
  return buildAnnotations(detectedPatterns, emptyAi, sourceText);
}

function buildAiAnnotations(detectedPatterns: DetectedPatternResult[], aiByPattern: AiResult[], sourceText: string): AnnotationOut[] {
  return buildAnnotations(detectedPatterns, aiByPattern, sourceText);
}

function buildAnnotations(detectedPatterns: DetectedPatternResult[], aiByPattern: AiResult[], sourceText: string): AnnotationOut[] {
  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const annotations: AnnotationOut[] = [];
  let counter = 1;

  detectedPatterns.forEach((pattern, patternIndex) => {
    const aiResult: AiResult = aiByPattern[patternIndex] || {
      status: 'failed',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
    const aiDocs   = aiResult.documentationByTarget || {};
    const aiTests  = aiResult.unitTestPlanByTarget || {};

    const lset = lexemesForPattern(pattern.patternName || pattern.patternId);
    const lexemeHints = lset ? [...lset.keywords, ...lset.methods, ...lset.idioms] : undefined;

    (pattern.documentationTargets || []).forEach((anchor) => {
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
        kind:     anchor.label,
        patternKey: pattern.patternName || pattern.patternId,
        className:  pattern.className,
        lexemeHints
      });
    });

    (pattern.unitTestTargets || []).forEach((target) => {
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
        kind:     `unit_test:${target.branch_kind}`,
        patternKey: pattern.patternName || pattern.patternId,
        className:  pattern.className,
        lexemeHints
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

function buildCommentedCode(sourceText: string, annotations: AnnotationOut[]): string {
  const normalized = (sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const groups = new Map<number, AnnotationOut[]>();
  annotations.forEach((annotation) => {
    const line = annotation.line || 1;
    if (!groups.has(line)) groups.set(line, []);
    groups.get(line)!.push(annotation);
  });
  const width = String(lines.length).length;
  const out: string[] = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const lineLabel  = String(lineNumber).padStart(width, ' ');
    out.push(`${lineLabel} | ${line}`);
    const comments = groups.get(lineNumber) || [];
    comments.forEach((c) => {
      out.push(`  // [Comment ${c.order}] ${c.stage}: ${c.title} - ${c.comment}`);
    });
  });
  return out.join('\n');
}

function buildCommentsOnly(sourceName: string, annotations: AnnotationOut[]): string {
  const out: string[] = [`# Comments for ${sourceName}`, '', `- Comment count: ${annotations.length}`, ''];
  annotations.forEach((a) => {
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

function buildDownloadFilename(sourceName: string, format: string): string {
  const base = path.basename(sourceName, path.extname(sourceName)) || 'analysis';
  return format === 'comments-only' ? `${base}.comments.md` : `${base}.commented.cpp`;
}

function deriveAnnotations(analysis: { annotations?: AnnotationOut[]; detectedPatterns?: DetectedPatternResult[]; aiByPattern?: AiResult[] }, sourceText: string): AnnotationOut[] {
  if (Array.isArray(analysis.annotations) && analysis.annotations.length) {
    return analysis.annotations;
  }
  return buildAnnotations(
    analysis.detectedPatterns || [],
    analysis.aiByPattern      || [],
    sourceText
  );
}

interface CountRow { count: number }
interface LatestRunRow { source_name: string; findings_count: number; created_at: string }

router.get('/health', (_req: Request, res: Response) => {
  const totalRuns = (() => {
    try {
      return (db.prepare('SELECT COUNT(*) AS count FROM analysis_runs').get() as CountRow).count;
    } catch {
      return 0;
    }
  })();

  const latestRun = (() => {
    try {
      return (db.prepare(`
        SELECT source_name, findings_count, created_at
        FROM analysis_runs
        ORDER BY id DESC
        LIMIT 1
      `).get() as LatestRunRow | undefined) || null;
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
    catalogFound: fs.existsSync(catalogPath),
    connected: false
  };
  microservice.connected = microservice.binaryFound && microservice.catalogFound;

  res.json({
    status: 'ok',
    service: 'NeoTerritory analysis api',
    aiProviderConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    aiModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
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

router.get('/sample', (_req: Request, res: Response) => {
  const samplePath = path.join(__dirname, '..', '..', 'uploads', 'sample.cpp');
  const fallbackProjectSample = path.join(
    __dirname, '..', '..', '..', '..',
    'Codebase', 'Microservice', 'samples', 'integration', 'all_patterns.cpp'
  );
  const sourcePath = fs.existsSync(samplePath) ? samplePath
                   : fs.existsSync(fallbackProjectSample) ? fallbackProjectSample
                   : null;
  if (!sourcePath) {
    res.status(404).json({ error: 'No sample source available.' });
    return;
  }
  const code = fs.readFileSync(sourcePath, 'utf8');
  res.json({
    filename: path.basename(sourcePath),
    code
  });
});

router.post('/analyze', jwtAuth, upload.single('file'), maybeValidateAnalyzeBody, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { code?: unknown; filename?: unknown };
    const codeFromBody = typeof body.code === 'string' ? body.code : '';
    const filenameFromBody = typeof body.filename === 'string' && body.filename.trim()
      ? body.filename.trim()
      : 'snippet.cpp';

    let sourceName = filenameFromBody;
    let sourceText = codeFromBody;

    if (req.file) {
      sourceName = req.file.originalname;
      sourceText = fs.readFileSync(req.file.path, 'utf8');
    }

    // Validate filename even on the multipart path (Multer uses originalname).
    const filenameCheck = filenameSchema.safeParse(sourceName);
    if (!filenameCheck.success) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({
        error: 'Validation failed',
        issues: filenameCheck.error.issues
      });
      return;
    }
    sourceName = filenameCheck.data;

    if (!sourceText.trim()) {
      res.status(400).json({ error: 'Provide a file or source code text.' });
      return;
    }
    if (sourceText.length > 1_000_000) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Source code exceeds 1,000,000 character limit.' });
      return;
    }

    const structural: AnalysisResult = analyzeClassDeclaration({ sourceName, code: sourceText });

    const detectedPatterns = structural.detectedPatterns || [];
    const enrichedPatterns = detectedPatterns.map(p => {
      const lset = lexemesForPattern(p.patternName || p.patternId);
      return lset ? { ...p, patternLexemes: lset } : p;
    });
    const ranking = rankAll(detectedPatterns, sourceText);
    const classUsageBindings = bindClassUsages(sourceText, detectedPatterns);
    const aiEnabled = aiCommenterEnabled();
    const aiByPattern: AiResult[] = detectedPatterns.map(() => ({
      status: 'skipped',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    }));
    const annotations = buildStructuralAnnotations(detectedPatterns, sourceText);
    const pipeline = buildPipelineFromMetrics(structural.stageMetrics, detectedPatterns.length);

    const analysis: AnalysisPayload = {
      sourceName,
      stage:               structural.stage,
      diagnostics:         structural.diagnostics || [],
      detectedPatterns,
      documentationTargets: structural.documentationTargets || [],
      unitTestTargets:      structural.unitTestTargets || [],
      aiByPattern,
      ranking,
      classUsageBindings,
      classUsageBindingSource: 'heuristic',
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

    if (req.file) fs.unlink(req.file.path, () => {});

    // Ephemeral: do NOT persist. Stash payload and return a pendingId.
    const pendingId = stashPending({
      sourceName,
      sourceText,
      analysis,
      userId: req.user?.id
    });

    logEvent(req.user?.id ?? null, 'analysis', `Analyzed (unsaved): ${sourceName}`);

    let aiJobId: string | null = null;
    let aiStatus: 'pending' | 'disabled' = 'disabled';
    if (aiEnabled && detectedPatterns.length > 0) {
      aiStatus = 'pending';
      aiJobId = newAiJobId();
      aiJobs.set(aiJobId, {
        status: 'pending',
        expiresAt: Date.now() + AI_JOB_TTL_MS
      });
      const jobId = aiJobId;
      const patternsForAi = detectedPatterns;
      const sourceForAi = sourceText;
      setImmediate(() => {
        Promise.all(
          patternsForAi.map((pattern) =>
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
        )
          .then((aiResults) => {
            const aiAnnotations = buildAiAnnotations(patternsForAi, aiResults, sourceForAi);
            aiJobs.set(jobId, {
              status: 'ready',
              annotations: aiAnnotations,
              expiresAt: Date.now() + AI_JOB_TTL_MS
            });
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'AI commentary failed';
            aiJobs.set(jobId, {
              status: 'failed',
              error: message,
              expiresAt: Date.now() + AI_JOB_TTL_MS
            });
          });
      });
    }

    res.status(200).json({
      ...analysis,
      detectedPatterns: enrichedPatterns,
      pendingId,
      saved:         false,
      sourceName,
      sourceText,
      aiStatus,
      aiJobId
    });
  } catch (err) {
    next(err);
  }
});

router.post('/runs/save', jwtAuth, validateBody(saveRunSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pendingId, userResolvedPattern } = req.body as { pendingId: string; userResolvedPattern?: string };
    const pending = takePending(pendingId, req.user?.id);
    if (!pending) {
      res.status(404).json({ error: 'Pending run not found or expired' });
      return;
    }
    if (userResolvedPattern && typeof userResolvedPattern === 'string') {
      pending.analysis.userResolvedPattern = userResolvedPattern;
    }

    const userDirName = safeUsername(req.user?.username);
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
      userId:     req.user?.id
    });

    logEvent(req.user?.id ?? null, 'save', `Saved run: ${pending.sourceName}`);

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

interface AnalysisRunListRow {
  id: number;
  source_name: string;
  structure_score: number;
  modernization_score: number;
  findings_count: number;
  created_at: string;
}

router.get('/runs', jwtAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const rows = db.prepare(`
      SELECT id, source_name, structure_score, modernization_score, findings_count, created_at
      FROM analysis_runs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(req.user.id, limit) as AnalysisRunListRow[];
    res.json({ runs: rows });
  } catch (err) {
    next(err);
  }
});

interface AnalysisRunFullRow {
  id: number;
  source_name: string;
  source_text: string;
  analysis_json: string;
  artifact_path: string;
  created_at: string;
}

router.get('/runs/:id', jwtAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id) as AnalysisRunFullRow | undefined;
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

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

router.get('/runs/:id/artifact', jwtAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id) as AnalysisRunFullRow | undefined;
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    if (!fs.existsSync(run.artifact_path)) {
      res.status(404).json({ error: 'Artifact missing' });
      return;
    }
    res.download(run.artifact_path);
  } catch (err) {
    next(err);
  }
});

router.get('/runs/:id/export', jwtAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const run = db.prepare('SELECT * FROM analysis_runs WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id) as AnalysisRunFullRow | undefined;
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

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

router.get('/analyze/ai/:jobId', jwtAuth, (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const entry = aiJobs.get(jobId);
  if (!entry) {
    res.status(404).json({ error: 'AI job not found or expired' });
    return;
  }
  if (entry.expiresAt < Date.now()) {
    aiJobs.delete(jobId);
    res.status(404).json({ error: 'AI job expired' });
    return;
  }
  if (entry.status === 'ready') {
    res.json({ status: 'ready', annotations: entry.annotations || [] });
    return;
  }
  if (entry.status === 'failed') {
    res.json({ status: 'failed', error: entry.error || 'AI commentary failed' });
    return;
  }
  res.json({ status: 'pending' });
});

interface ManualReviewRow {
  id: number;
  user_id: number;
}

router.post('/analysis/:runId/manual-review', jwtAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const runIdNum = Number(req.params.runId);
    if (!Number.isFinite(runIdNum)) {
      res.status(400).json({ error: 'Invalid runId' });
      return;
    }
    const owner = db.prepare('SELECT id, user_id FROM analysis_runs WHERE id = ?')
      .get(runIdNum) as ManualReviewRow | undefined;
    if (!owner) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    if (owner.user_id && owner.user_id !== req.user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as {
      line?: unknown;
      candidates?: unknown;
      chosenPattern?: unknown;
      chosenKind?: unknown;
      otherText?: unknown;
    };
    const line = Number(body.line);
    if (!Number.isFinite(line) || line < 1) {
      res.status(400).json({ error: 'Invalid line' });
      return;
    }
    if (!Array.isArray(body.candidates)) {
      res.status(400).json({ error: 'candidates must be an array' });
      return;
    }
    const candidates = body.candidates.filter((c): c is string => typeof c === 'string').slice(0, 32);
    const chosenKindRaw = typeof body.chosenKind === 'string' ? body.chosenKind : 'pattern';
    const chosenKind: 'pattern' | 'none' | 'other' =
      chosenKindRaw === 'none' ? 'none' :
      chosenKindRaw === 'other' ? 'other' : 'pattern';
    const chosenPattern = chosenKind === 'pattern' && typeof body.chosenPattern === 'string'
      ? body.chosenPattern.slice(0, 128)
      : null;
    const otherText = chosenKind === 'other' && typeof body.otherText === 'string'
      ? body.otherText.slice(0, 1024)
      : null;

    db.prepare(`INSERT INTO manual_pattern_decisions
      (run_id, user_id, line, candidates_json, chosen_pattern, chosen_kind, other_text, decided_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      runIdNum,
      req.user.id,
      line,
      JSON.stringify(candidates),
      chosenPattern,
      chosenKind,
      otherText
    );

    logEvent(req.user.id, 'manual_review', `runId=${runIdNum} line=${line} kind=${chosenKind}`);

    res.status(201).json({ ok: true, line, chosenPattern, chosenKind });
  } catch (err) {
    next(err);
  }
});

export default router;
