import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
import type { ClassUsageBinding } from '../types/api';
import { logEvent } from '../services/logService';
import { mirrorRow } from '../services/supabaseLogger';
import {
  runSubmissionCompile, runPatternUnitTest,
  isTestRunnerEnabled, getDisableReason, TestResult
} from '../services/testRunnerService';
import {
  reserveRun, findActiveRunFor, getRun,
  pushPhaseEvent, markRunDone, subscribeRun, RunEvent
} from '../services/runEventsStore';
import { ensurePod, isPodModeEnabled, podManagerStatus, podWarmupDecision, shouldWarmupPods } from '../services/podManager';
import {
  getMicroserviceStatus,
  getAiTranslatorStatus,
  getPrivateSnapshot as getMasterlistPrivateSnapshot,
} from '../services/healthMasterlist';
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
  classResolvedPatterns?: Record<string, string>;
  // Multi-file payload preserved across save/load so the run-list can
  // restore every file when an old run is reopened. Single-file legacy runs
  // get back-filled with one entry mirroring sourceName + sourceText.
  files?: Array<{ name: string; sourceText: string }>;
  // Family-keyed list of pattern short names that propagate to subclasses,
  // mirrored from `pattern_catalog/inheritance_driven_patterns.json`. Sent
  // verbatim so the frontend's annotated-source model can decide cascade
  // behaviour without hardcoding pattern names.
  inheritanceDrivenPatterns?: Record<string, string[]>;
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
  // Multi-file: which file in fileList[] this annotation belongs to.
  fileName?: string;
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

// Cache the inheritance masterlist so repeated /analyze calls don't
// hit the disk. Cleared via INHERITANCE_MASTERLIST_TTL_MS to pick up
// catalog edits without a backend restart.
let inheritanceMasterlistCache: { value: Record<string, string[]>; loadedAt: number } | null = null;
const INHERITANCE_MASTERLIST_TTL_MS = 30_000;

function loadInheritanceMasterlist(): Record<string, string[]> {
  const now = Date.now();
  if (inheritanceMasterlistCache && (now - inheritanceMasterlistCache.loadedAt) < INHERITANCE_MASTERLIST_TTL_MS) {
    return inheritanceMasterlistCache.value;
  }
  const empty: Record<string, string[]> = {};
  try {
    const file = path.join(resolveCatalogPath(), 'inheritance_driven_patterns.json');
    if (!fs.existsSync(file)) {
      inheritanceMasterlistCache = { value: empty, loadedAt: now };
      return empty;
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { families?: Record<string, unknown> };
    const out: Record<string, string[]> = {};
    const fams = parsed?.families;
    if (fams && typeof fams === 'object') {
      for (const [family, list] of Object.entries(fams)) {
        if (!Array.isArray(list)) continue;
        out[family] = list.filter((s): s is string => typeof s === 'string');
      }
    }
    inheritanceMasterlistCache = { value: out, loadedAt: now };
    return out;
  } catch {
    inheritanceMasterlistCache = { value: empty, loadedAt: now };
    return empty;
  }
}

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
interface PatternEducationOut {
  explanation: string;
  whyThisFired: string;
  studyHint: string;
}
interface AiJobEntry {
  status: 'pending' | 'ready' | 'failed';
  annotations?: AnnotationOut[];
  // Keyed by `${patternId}|${className}` so the frontend can attach the
  // beginner-voice copy to the matching detected pattern card.
  educationByPatternKey?: Record<string, PatternEducationOut>;
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

  const newId = Number(info.lastInsertRowid);
  const createdAt = new Date().toISOString();
  // Mirror the FULL run to Supabase so admin views (tagged patterns, stage
  // metrics for time/memory, findings) survive a Lightsail spot termination.
  // analysis is stored as jsonb so SQL filters/joins work on the Supabase side.
  mirrorRow('analysis_runs', {
    id: newId,
    user_id: input.userId || null,
    source_name: input.sourceName,
    source_text: input.sourceText,
    analysis: input.analysis,
    artifact_path: input.artifactPath,
    structure_score: 0,
    modernization_score: 0,
    findings_count: findingsCount,
    created_at: createdAt,
  });
  return { id: info.lastInsertRowid as number | bigint, createdAt };
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

// Frontend-emitted event log. Anything that happens in the SPA the user
// cares about (tab switches, run dispatch, sample loads, sign-out, errors)
// posts here so it lands in the same `logs` table the backend writes to.
// Keys are namespaced with `frontend.<verb>` so the admin LogsView can split
// them into a dedicated tab without colliding with backend event types.
const FRONTEND_EVENT_RE = /^frontend\.[a-z0-9_-]{1,64}$/i;
router.post('/log/event', jwtAuth, (req: Request, res: Response) => {
  const { eventType, message } = (req.body || {}) as { eventType?: string; message?: string };
  if (typeof eventType !== 'string' || !FRONTEND_EVENT_RE.test(eventType)) {
    res.status(400).json({ error: 'eventType must match frontend.<name>' });
    return;
  }
  const safeMsg = typeof message === 'string' ? message.slice(0, 500) : '';
  logEvent(req.user?.id ?? null, eventType, safeMsg);
  res.status(204).end();
});

// Per-user test-run accuracy. Mirrors /admin/stats/test-runs but filters
// the logs table to the calling user's events. Drives the user-facing
// pass/fail counter in the studio.
router.get('/stats/my-test-runs', jwtAuth, (req: Request, res: Response) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  interface Row { event_type: string; n: number }
  const rows = db.prepare(
    `SELECT event_type, COUNT(*) AS n
     FROM logs
     WHERE event_type LIKE 'gdb.%' AND user_id = ?
     GROUP BY event_type`
  ).all(req.user.id) as Row[];
  let passed = 0, failed = 0;
  const phaseMap = new Map<string, { passed: number; failed: number }>();
  for (const r of rows) {
    const m = r.event_type.match(/^gdb\.([^.]+)\.(pass|fail)$/);
    if (!m) continue;
    const [, phase, kind] = m;
    const slot = phaseMap.get(phase) || { passed: 0, failed: 0 };
    if (kind === 'pass') { slot.passed += r.n; passed += r.n; }
    else                 { slot.failed += r.n; failed += r.n; }
    phaseMap.set(phase, slot);
  }
  const total = passed + failed;
  res.json({
    total, passed, failed,
    passRate: total > 0 ? passed / total : 0,
    perPhase: [...phaseMap.entries()].map(([phase, v]) => ({ phase, ...v }))
  });
});

router.get('/health', (req: Request, res: Response) => {
  // Health stays public so the boot screen / unauthenticated probes
  // work, but if the caller does present a valid Bearer JWT we decode
  // it to surface per-user pod status (`docker.mine`). Decoding failure
  // is silent — the route still returns the public payload.
  let callerUserId: number | null = null;
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id?: number };
      if (typeof decoded?.id === 'number') callerUserId = decoded.id;
    } catch { /* invalid / expired — leave callerUserId null */ }
  }

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

  // Public masterlist values — checked synchronously at request time
  // because they are cheap (filesystem existence + env-var presence)
  // and the caller needs an authoritative answer immediately.
  const microservice = getMicroserviceStatus();
  const ai           = getAiTranslatorStatus();

  // Private masterlist — Docker / pods. Read-only snapshot of state
  // maintained by dockerWatcher (background prober) and podManager
  // (event-driven on ensurePod / disposePod). /api/health never spawns
  // a docker subprocess; if the watcher hasn't flipped Docker online
  // yet, this returns "offline" and the frontend renders accordingly.
  const masterlistPriv = getMasterlistPrivateSnapshot(callerUserId);
  // Merge the existing podManager surface (still includes pod-mode
  // enabled/disabled reasons that the watcher doesn't track) with the
  // masterlist's authoritative live data, so frontend payload shape
  // stays compatible. Anything time-sensitive comes from masterlist.
  const dockerLegacy = podManagerStatus(callerUserId);
  const docker = {
    enabled:       dockerLegacy.enabled,
    reason:        dockerLegacy.reason,
    online:        masterlistPriv.docker.online,
    imageReady:    masterlistPriv.docker.imageReady,
    livePods:      masterlistPriv.docker.livePods,
    mine:          masterlistPriv.docker.mine,
    lastCheckedAt: masterlistPriv.docker.lastCheckedAt,
  };

  res.json({
    status: 'ok',
    service: 'NeoTerritory analysis api',
    aiProviderConfigured: ai.configured,
    aiModel:              ai.model,
    maxFilesPerSubmission: Math.min(16, Math.max(1, Number(process.env.MAX_FILES_PER_SUBMISSION || '3'))),
    testRunnerEnabled: isTestRunnerEnabled(),
    gdbRunsPerWindow: GDB_RUNS_PER_WINDOW,
    gdbCooldownMs: GDB_COOLDOWN_MS,
    microservice,
    docker,
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
  // Try the canonical locations under both ts-node and compiled layouts.
  // ts-node: __dirname = Backend/src/routes
  // dist:    __dirname = Backend/dist/src/routes
  const candidates = [
    // Backend-local upload override (operator-customised sample).
    path.join(__dirname, '..', '..', 'uploads', 'sample.cpp'),       // ts-node
    path.join(__dirname, '..', '..', '..', 'uploads', 'sample.cpp'), // dist
    // Repo-shipped reference sample.
    path.join(__dirname, '..', '..', '..', '..',
              'Codebase', 'Microservice', 'samples', 'integration', 'all_patterns.cpp'),  // ts-node
    path.join(__dirname, '..', '..', '..', '..', '..',
              'Codebase', 'Microservice', 'samples', 'integration', 'all_patterns.cpp'),  // dist
  ];
  const sourcePath = candidates.find((p) => fs.existsSync(p)) || null;
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
    const body = req.body as {
      code?: unknown;
      filename?: unknown;
      files?: unknown;
    };
    // Build the file list. Three input shapes are honoured:
    //   1. multipart `file` field (single legacy upload)
    //   2. JSON `{ code, filename }` (single legacy paste)
    //   3. JSON `{ files: [{ code, name }] }` (new multi-file)
    const fileList: Array<{ name: string; code: string }> = [];
    if (Array.isArray(body.files)) {
      for (const entry of body.files) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as { code?: unknown; name?: unknown };
        if (typeof e.code === 'string' && typeof e.name === 'string') {
          fileList.push({ name: e.name, code: e.code });
        }
      }
    } else if (req.file) {
      fileList.push({
        name: req.file.originalname,
        code: fs.readFileSync(req.file.path, 'utf8')
      });
    } else {
      const codeFromBody = typeof body.code === 'string' ? body.code : '';
      const filenameFromBody = typeof body.filename === 'string' && body.filename.trim()
        ? body.filename.trim()
        : 'snippet.cpp';
      if (codeFromBody) fileList.push({ name: filenameFromBody, code: codeFromBody });
    }

    if (fileList.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Provide a file or source code text.' });
      return;
    }
    // Per-user file cap. Default 3 keeps research sessions within the
    // microservice's tested envelope; raise via MAX_FILES_PER_SUBMISSION
    // (capped server-side at 16 regardless of env, as a safety floor).
    const envCap = Math.min(16, Math.max(1, Number(process.env.MAX_FILES_PER_SUBMISSION || '3')));
    if (fileList.length > envCap) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: `At most ${envCap} files per submission.` });
      return;
    }

    // Validate every filename and total size envelope.
    let totalChars = 0;
    for (const f of fileList) {
      const check = filenameSchema.safeParse(f.name);
      if (!check.success) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(400).json({
          error: 'Validation failed',
          issues: check.error.issues
        });
        return;
      }
      f.name = check.data;
      totalChars += f.code.length;
    }
    if (totalChars > 4_000_000) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Combined source exceeds 4,000,000 character limit.' });
      return;
    }

    // Run the structural analyzer per-file and merge. Per-file annotations
    // carry line numbers relative to that file, which is what the per-file
    // source view needs to render. Detected patterns get their `fileName`
    // stamped so the frontend can route them.
    const allDetected: typeof fileList extends unknown ? DetectedPatternResult[] : never =
      [] as DetectedPatternResult[];
    const allAnnotations: AnnotationOut[] = [];
    const mergedClassUsageBindings: Record<string, ClassUsageBinding[]> = {};
    let mergedStageMetrics: AnalysisResult['stageMetrics'] = [];
    // Display name derivation: prefer a file literally named main.cpp (case-
    // insensitive), then any file whose source contains `int main(`, then
    // fall back to the first file. This is what the saved-runs list renders.
    const mainCppMatch = fileList.find(f => /^main\.(cpp|cc|cxx)$/i.test(f.name));
    const intMainMatch = fileList.find(f => /\bint\s+main\s*\(/.test(f.code));
    let primaryName = (mainCppMatch || intMainMatch || fileList[0]).name;

    for (const f of fileList) {
      console.log(`[NT] analyzing  file=${f.name}`);
      const r: AnalysisResult = analyzeClassDeclaration({ sourceName: f.name, code: f.code });
      const stamped = (r.detectedPatterns || []).map(p => ({
        ...p,
        fileName: f.name
      }));
      allDetected.push(...stamped);
      const fileAnns = buildStructuralAnnotations(stamped, f.code).map(a => ({
        ...a,
        fileName: f.name
      } as AnnotationOut));
      allAnnotations.push(...fileAnns);
      const bindings = bindClassUsages(f.code, stamped);
      for (const [cls, rows] of Object.entries(bindings)) {
        if (!mergedClassUsageBindings[cls]) mergedClassUsageBindings[cls] = [];
        for (const rec of rows as unknown as ClassUsageBinding[]) {
          mergedClassUsageBindings[cls].push({ ...rec, fileName: f.name });
        }
      }
      mergedStageMetrics = mergedStageMetrics.concat(r.stageMetrics || []);
    }

    // Synthesise a "primary" view for the rest of the pipeline (ranking,
    // existing class-fit logic) using the first file's source text. Multi-
    // file ranking gets the same treatment as before per-file; downstream
    // consumers that read sourceName/sourceText keep working.
    const sourceName = primaryName;
    const sourceText = fileList[0].code;
    const structural: AnalysisResult = {
      ...({} as AnalysisResult),
      detectedPatterns: allDetected,
      documentationTargets: allDetected.flatMap(p => p.documentationTargets || []),
      unitTestTargets: allDetected.flatMap(p => p.unitTestTargets || []),
      diagnostics: [],
      stage: 'pattern_dispatch',
      stageMetrics: mergedStageMetrics,
      artifacts: {},
      runDirectory: undefined,
      outputDirectory: undefined
    };

    const detectedPatterns = structural.detectedPatterns || [];
    const enrichedPatterns = detectedPatterns.map(p => {
      const lset = lexemesForPattern(p.patternName || p.patternId);
      return lset ? { ...p, patternLexemes: lset } : p;
    });
    // Run ranking against the concatenated text so cross-file rivalry counts;
    // bindings are already per-file via the merge loop above.
    const concatenatedSource = fileList.map(f => f.code).join('\n// --- file boundary ---\n');
    const ranking = rankAll(detectedPatterns, concatenatedSource);
    const classUsageBindings = mergedClassUsageBindings;
    const aiEnabled = aiCommenterEnabled();
    const aiByPattern: AiResult[] = detectedPatterns.map(() => ({
      status: 'skipped',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    }));
    // Per-file annotations were already built during the per-file analyze loop
    // above. Reuse them here so line numbers stay relative to the file the
    // frontend will render in its per-file tab.
    const annotations = allAnnotations;
    const pipeline = buildPipelineFromMetrics(structural.stageMetrics, detectedPatterns.length);

    const analysis: AnalysisPayload = {
      sourceName,
      stage:               structural.stage,
      diagnostics:         structural.diagnostics || [],
      // Keep the same enriched shape in pending storage that we return to
      // clients so /api/analysis/run-tests can consume className/classText.
      detectedPatterns: enrichedPatterns,
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
      transformedPreview: '',
      // Multi-file payload: every uploaded source travels through the saved
      // run so reopening it from the run-list restores all per-file tabs.
      files: fileList.map(f => ({ name: f.name, sourceText: f.code })),
      inheritanceDrivenPatterns: loadInheritanceMasterlist()
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

    const warmupUser = req.user;
    if (warmupUser && isPodModeEnabled() && shouldWarmupPods()) {
      console.log('[pod-warmup] warmup scheduled (reason=submit)');
      setImmediate(() => {
        void ensurePod(warmupUser.id, warmupUser.username || `user-${warmupUser.id}`).catch(() => { /* logged inside */ });
      });
    } else if (warmupUser && isPodModeEnabled()) {
      const reason = podWarmupDecision();
      console.log(`[pod-warmup] warmup skipped (reason=${reason})`);
    }

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
            const educationByPatternKey: Record<string, PatternEducationOut> = {};
            patternsForAi.forEach((pattern, idx) => {
              const edu = aiResults[idx]?.education;
              if (edu && (edu.explanation || edu.whyThisFired || edu.studyHint)) {
                const key = `${pattern.patternId}|${pattern.className || ''}`;
                educationByPatternKey[key] = {
                  explanation:  edu.explanation || '',
                  whyThisFired: edu.whyThisFired || '',
                  studyHint:    edu.studyHint || ''
                };
              }
            });
            aiJobs.set(jobId, {
              status: 'ready',
              annotations: aiAnnotations,
              educationByPatternKey,
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
      // New: per-file payload so the frontend can render per-file tabs.
      files: fileList.map(f => ({ name: f.name, sourceText: f.code })),
      aiStatus,
      aiJobId
    });
  } catch (err) {
    next(err);
  }
});

// Single-button "Submit validation & save". Re-uses the same Zod schema
// + the save handler so the studio can collapse its two-step flow into
// one click without changing the underlying persistence path.
router.post('/runs/submit-and-save', jwtAuth, validateBody(saveRunSchema), (req: Request, res: Response, next: NextFunction) => {
  // Delegate to the same handler — validation already happened via the
  // shared middleware. This route exists so the frontend can call a
  // semantically-named endpoint and so future server-side validation
  // can hang off it without touching /runs/save's contract.
  return saveRunHandler(req, res, next);
});

router.post('/runs/save', jwtAuth, validateBody(saveRunSchema), (req: Request, res: Response, next: NextFunction) => {
  return saveRunHandler(req, res, next);
});

function saveRunHandler(req: Request, res: Response, next: NextFunction): void {
  try {
    const { pendingId, userResolvedPattern, classResolvedPatterns } = req.body as {
      pendingId: string;
      userResolvedPattern?: string;
      classResolvedPatterns?: Record<string, string>;
    };
    const pending = takePending(pendingId, req.user?.id);
    if (!pending) {
      res.status(404).json({ error: 'Pending run not found or expired' });
      return;
    }
    if (userResolvedPattern && typeof userResolvedPattern === 'string') {
      pending.analysis.userResolvedPattern = userResolvedPattern;
    }
    if (classResolvedPatterns && typeof classResolvedPatterns === 'object') {
      // Persist the per-class map alongside the legacy single-value field so
      // reloading a saved run restores every class's chosen pattern.
      pending.analysis.classResolvedPatterns = classResolvedPatterns;
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
}

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
    res.json({
      status: 'ready',
      annotations: entry.annotations || [],
      educationByPatternKey: entry.educationByPatternKey || {}
    });
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

    // Completeness guard: 'pattern' kind must include a chosenPattern; 'none'
    // and 'other' must not. Reject malformed combos with 422 so a client that
    // skipped the form gets bounced before persistence.
    if (chosenKind === 'pattern' && !chosenPattern) {
      res.status(422).json({ error: 'chosenPattern is required when chosenKind is "pattern"' });
      return;
    }
    if (chosenKind === 'other' && !otherText) {
      res.status(422).json({ error: 'otherText is required when chosenKind is "other"' });
      return;
    }

    // Idempotency — re-submitting the SAME (run, user, line, kind,
    // pattern, otherText) tuple within 60s is treated as a no-op
    // success rather than a duplicate INSERT. The validation flow
    // streams every row in a tight loop; if the user double-clicks
    // the Save & submit button (or the network retries the request)
    // we don't want duplicate decision rows polluting the F1 metrics.
    const dupe = db.prepare(`
      SELECT id FROM manual_pattern_decisions
       WHERE run_id = ? AND user_id = ? AND line = ?
         AND COALESCE(chosen_pattern,'') = COALESCE(?, '')
         AND chosen_kind = ?
         AND COALESCE(other_text,'') = COALESCE(?, '')
         AND decided_at >= datetime('now','-60 seconds')
       LIMIT 1
    `).get(runIdNum, req.user.id, line, chosenPattern, chosenKind, otherText);

    if (!dupe) {
      const mInfo = db.prepare(`INSERT INTO manual_pattern_decisions
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
      mirrorRow('manual_pattern_decisions', {
        id: Number(mInfo.lastInsertRowid),
        run_id: runIdNum, user_id: req.user.id, line,
        candidates: candidates,
        chosen_pattern: chosenPattern,
        chosen_kind: chosenKind,
        other_text: otherText,
        decided_at: new Date().toISOString(),
      });
    }

    logEvent(req.user.id, 'manual_review', `runId=${runIdNum} line=${line} kind=${chosenKind}`);

    res.status(201).json({ ok: true, line, chosenPattern, chosenKind });
  } catch (err) {
    next(err);
  }
});

// Pre-templated unit-test runner. Compiles the user's class against per-
// pattern templates inside a sandbox and reports pass/fail/timeout/segfault.
// Returns 503 with a clear message when the runner is disabled (default), so
// the frontend can render a "configure ENABLE_TEST_RUNNER to enable" banner.
//
// Saving is NOT required — the runner works on either a saved runId (path
// param) or a still-pending pendingId (JSON body). Either form looks up the
// detected patterns + classText and dispatches per-pattern tests.
//
// Rate limit: GDB_RUNS_PER_WINDOW (default 5) attempts per user per
// GDB_COOLDOWN_MS (default 60_000 ms). Exceeding the budget returns 429 with
// Retry-After.
interface RunTestsRow { id: number; user_id: number | null; source_text: string; analysis_json: string }
const GDB_RUNS_PER_WINDOW = Number(process.env.GDB_RUNS_PER_WINDOW || '5');
const GDB_COOLDOWN_MS = Number(process.env.GDB_COOLDOWN_MS || '60000');
const gdbAttempts = new Map<number, number[]>();  // userId -> sorted timestamps

function gdbBudgetCheck(userId: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - GDB_COOLDOWN_MS;
  const arr = (gdbAttempts.get(userId) || []).filter(t => t >= cutoff);
  if (arr.length >= GDB_RUNS_PER_WINDOW) {
    const retryAfterMs = Math.max(0, arr[0] + GDB_COOLDOWN_MS - now);
    gdbAttempts.set(userId, arr);
    return { allowed: false, retryAfterMs };
  }
  arr.push(now);
  gdbAttempts.set(userId, arr);
  return { allowed: true, retryAfterMs: 0 };
}

// Probe the class text for a method that *looks* like a Singleton instance
// accessor — `static T& instance()`, `static T* getInstance()`, etc. Without
// this, the templated test driver hard-codes "instance" and breaks on the
// (very common) classes that name their accessor differently.
function detectInstanceAccessor(classText: string, className: string): string {
  const candidates = ['instance', 'getInstance', 'get_instance', 'GetInstance', 'sharedInstance', 'getDefault'];
  // Prefer accessors that explicitly return a reference/pointer to the class.
  for (const name of candidates) {
    const re = new RegExp(
      `\\bstatic\\s+(?:const\\s+)?${className}\\s*[&*]?\\s*${name}\\s*\\(`
    );
    if (re.test(classText)) return name;
  }
  // Fallback: any static method on the class with one of the canonical names.
  for (const name of candidates) {
    const re = new RegExp(`\\bstatic\\b[^;]*\\b${name}\\s*\\(`);
    if (re.test(classText)) return name;
  }
  return 'instance';
}

// Same idea for the canonical method the templates dispatch through. We try
// to lift the actual method name from unit-test targets, then fall back to
// scanning classText for the catalog's expected method names.
function pickMethodName(p: DetectedPatternResult, candidates: string[]): string | undefined {
  const fromTargets = (p.unitTestTargets || [])
    .map(t => t.function_name)
    .filter((n): n is string => !!n)
    .find(n => candidates.length === 0 || candidates.includes(n));
  if (fromTargets) return fromTargets;
  for (const name of candidates) {
    const re = new RegExp(`\\b${name}\\s*\\(`);
    if (re.test(p.classText || '')) return name;
  }
  return (p.unitTestTargets || [])[0]?.function_name;
}

// Optional per-phase callback. Fires the moment a single (phase, patternId)
// pair resolves, so a streaming caller (the SSE endpoint) can forward the
// verdict to the frontend before the rest of the batch is done. The
// callback is best-effort — its exceptions are swallowed so an SSE
// subscriber bug cannot break the rest of the run.
type PhaseEmitter = (result: TestResult) => void;

async function dispatchPatternTests(
  patterns: DetectedPatternResult[],
  fullSource: string,
  files?: Array<{ name: string; sourceText: string }>,
  userId?: number,
  stdin?: string,
  onPhase?: PhaseEmitter
): Promise<TestResult[]> {
  const safeEmit: PhaseEmitter = onPhase
    ? (r) => { try { onPhase(r); } catch { /* ignore subscriber errors */ } }
    : () => { /* no-op */ };

  const eligible = patterns.filter(p => p.className);
  if (eligible.length === 0) return [];

  // The compile_run phase only depends on the submission's source, so we run
  // it once and replay the same TestResult under every eligible pattern's
  // (patternId, className) keys. Cuts a 5-pattern submission from 10 compile
  // calls to 6, and each unit_test then runs in parallel below.
  const probe = eligible[0];
  const sharedCompile = await runSubmissionCompile({
    patternId:   probe.patternId,
    patternName: probe.patternName,
    className:   probe.className!,
    classText:   probe.classText!,
    fullSource,
    files,
    userId,
    stdin
  });

  const compileResults: TestResult[] = eligible.map(p => ({
    ...sharedCompile,
    patternId:   p.patternId,
    patternName: p.patternName,
    className:   p.className!
  }));
  for (const cr of compileResults) safeEmit(cr);

  // If the shared compile failed there is no point running any unit_test —
  // mark them all skipped at once with the same upstream message.
  if (!sharedCompile.passed) {
    const skips: TestResult[] = eligible.map(p => ({
      patternId:   p.patternId,
      patternName: p.patternName,
      className:   p.className!,
      phase:       'unit_test',
      passed:      false,
      expected:    'pass',
      actual:      '',
      exitCode:    0,
      durationMs:  0,
      verdict:     'skipped',
      message:     'Skipped — your class did not compile or did not exit cleanly on its own.'
    }));
    for (const sk of skips) safeEmit(sk);
    return [...compileResults, ...skips];
  }

  // Compile succeeded → run every unit_test driver in parallel. Each driver
  // gets its own scratch dir so they cannot collide on disk. Emit each
  // pattern's unit_test result as soon as its individual promise resolves —
  // do not wait for the whole Promise.all to settle before forwarding.
  const unitResults = await Promise.all(eligible.map(p => {
    const fallbackTarget = (p.unitTestTargets || [])[0]?.function_name;
    return runPatternUnitTest({
      patternId:        p.patternId,
      patternName:      p.patternName,
      className:        p.className!,
      classText:        p.classText!,
      fullSource,
      files,
      userId,
      stdin,
      forwardMethod:    pickMethodName(p, ['read', 'execute', 'request', 'render', 'process', 'handle']) || fallbackTarget,
      factoryFn:        pickMethodName(p, ['create', 'make', 'build', 'produce', 'newInstance']) || fallbackTarget,
      terminator:       pickMethodName(p, ['build', 'finalize', 'done', 'complete', 'produce']) || 'build',
      instanceAccessor: detectInstanceAccessor(p.classText!, p.className!),
      componentBase:    'Component',
      realBase:         'Subject',
      targetBase:       'Target',
      targetMethod:     fallbackTarget
    }).then((r) => { safeEmit(r); return r; });
  }));

  return [...compileResults, ...unitResults];
}

// A class is "ambiguous" when the matcher emitted two-or-more competing
// patterns for it AND the user has not explicitly resolved one via
// classResolvedPatterns. The runner refuses to run unit tests in that
// state — there's no defensible single pattern to test against, so we
// bounce the user back to the annotated view to disambiguate.
function findAmbiguousClasses(
  patterns: DetectedPatternResult[],
  resolvedMap: Record<string, string>
): string[] {
  const countByClass = new Map<string, number>();
  for (const p of patterns) {
    if (!p.className) continue;
    countByClass.set(p.className, (countByClass.get(p.className) || 0) + 1);
  }
  const out: string[] = [];
  for (const [name, count] of countByClass) {
    if (count > 1 && !resolvedMap[name]) out.push(name);
  }
  return out.sort();
}

// Keep only the patterns the user actually committed to: either the matcher
// gave a single confident detection for the class (no ambiguity), or the
// user picked one via classResolvedPatterns. Anything else is dropped so
// we don't waste compile cycles testing a hypothesis the user rejected.
function filterToTaggedPatterns(
  patterns: DetectedPatternResult[],
  resolvedMap: Record<string, string>
): DetectedPatternResult[] {
  const countByClass = new Map<string, number>();
  for (const p of patterns) {
    if (!p.className) continue;
    countByClass.set(p.className, (countByClass.get(p.className) || 0) + 1);
  }
  return patterns.filter(p => {
    if (!p.className) return false;
    const cnt = countByClass.get(p.className) || 0;
    if (cnt === 1) return true;
    return resolvedMap[p.className] === p.patternId;
  });
}

// Build a fresh runId for a streaming invocation. Same shape pattern as
// pendingId so logs are uniform across the analysis pipeline.
function generateRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Validate runId comes only from the controlled set of generators above.
// Anything else is rejected so a malicious client cannot collide with an
// existing run owned by another user.
function isValidRunId(s: unknown): s is string {
  return typeof s === 'string' && /^run_[a-z0-9]{1,16}_[a-z0-9]{1,16}$/i.test(s);
}

interface RunTestsOptions {
  patterns: DetectedPatternResult[];
  fullSource: string;
  files?: Array<{ name: string; sourceText: string }>;
  resolvedMap: Record<string, string>;
  stdin?: string;
}

async function handleRunTests(
  req: Request,
  res: Response,
  patterns: DetectedPatternResult[],
  fullSource: string,
  files?: Array<{ name: string; sourceText: string }>,
  resolvedMap: Record<string, string> = {},
  stdin?: string
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!isTestRunnerEnabled()) {
    res.status(503).json({
      error: 'Test runner not configured',
      detail: getDisableReason()
    });
    return;
  }
  // Admins are not rate-limited: they're operating the system, not running
  // synthetic load. Tester accounts still go through gdbBudgetCheck so a
  // misbehaving client can't pin the compile pool.
  const isAdmin = req.user.role === 'admin';
  const budget = isAdmin ? { allowed: true, retryAfterMs: 0 } : gdbBudgetCheck(req.user.id);
  if (!budget.allowed) {
    const retryS = Math.ceil(budget.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(retryS));
    res.status(429).json({
      error: 'Rate limited',
      detail: `Up to ${GDB_RUNS_PER_WINDOW} test runs per ${Math.round(GDB_COOLDOWN_MS / 1000)}s. Try again in ${retryS}s.`,
      retryAfterMs: budget.retryAfterMs
    });
    return;
  }
  // Block the run if any class still has competing patterns the user hasn't
  // resolved. The frontend uses this 409 to bounce back to the annotated
  // tab and prompt for disambiguation.
  const ambiguous = findAmbiguousClasses(patterns, resolvedMap);
  if (ambiguous.length > 0) {
    res.status(409).json({
      error: 'Ambiguous classes need resolution',
      detail: `Resolve a pattern for: ${ambiguous.join(', ')} on the Annotated source tab.`,
      ambiguousClasses: ambiguous
    });
    return;
  }
  const taggedPatterns = filterToTaggedPatterns(patterns, resolvedMap);

  // Streaming branch — when the client supplies a runId (or asks for one
  // via ?stream=1), the work runs in the background and each phase result
  // is emitted to the SSE channel keyed by that runId. The HTTP POST
  // returns 202 immediately so the FE can open the EventSource and start
  // rendering compile_run rows the moment they resolve.
  const body = (req.body || {}) as { runId?: unknown };
  const wantsStream = isValidRunId(body.runId) || req.query.stream === '1';
  if (wantsStream) {
    // Reject second run while one is already in flight for this user —
    // hand back the existing runId so the FE re-subscribes instead of
    // spawning a duplicate run.
    const active = findActiveRunFor(req.user.id);
    if (active) {
      res.status(202).json({ runId: active, accepted: false, reason: 'already_running' });
      return;
    }
    const runId = isValidRunId(body.runId) ? body.runId : generateRunId();
    if (!reserveRun(runId, req.user.id)) {
      res.status(409).json({ error: 'runId already in use', runId });
      return;
    }
    res.status(202).json({ runId, accepted: true });

    // Background dispatch. We deliberately do not await this — the
    // response has already been sent. Any thrown error is funnelled into
    // a synthetic done event so subscribers always see closure.
    void (async () => {
      try {
        const results = await dispatchPatternTests(
          taggedPatterns, fullSource, files, req.user?.id, stdin,
          (r) => pushPhaseEvent(runId, r.phase, r)
        );
        finalizeRunLogs(req.user?.id ?? null, results);
        markRunDone(runId, summarize(results), {
          window: GDB_RUNS_PER_WINDOW,
          cooldownMs: GDB_COOLDOWN_MS,
          remaining: Math.max(0, GDB_RUNS_PER_WINDOW - (gdbAttempts.get(req.user!.id) || []).length)
        });
      } catch (err) {
        markRunDone(runId, { total: 0, passed: 0, failed: 0 });
        // eslint-disable-next-line no-console
        console.error('[run-tests] background dispatch failed', err);
      }
    })();
    return;
  }

  // Legacy blocking path — the CI smoke test and the playwright check
  // still rely on the single-response shape. Keeping this branch means
  // older clients continue to work unchanged.
  const results = await dispatchPatternTests(taggedPatterns, fullSource, files, req.user?.id, stdin);
  finalizeRunLogs(req.user?.id ?? null, results);
  res.json({
    results,
    rateLimit: {
      window: GDB_RUNS_PER_WINDOW,
      cooldownMs: GDB_COOLDOWN_MS,
      remaining: Math.max(0, GDB_RUNS_PER_WINDOW - (gdbAttempts.get(req.user.id) || []).length)
    }
  });
}

// Validate the result set BEFORE logging anything — we only persist
// outcomes when every test result has the fields downstream consumers
// (admin accuracy, Logs tab) expect. Anything skipped (verdict=skipped /
// no_template / sandbox_disabled) is a non-result, not a failure, and
// must not pollute the gdb.<phase>.fail log stream — that's what was
// showing up as phantom failures in the accuracy chip.
function finalizeRunLogs(userId: number | null, results: TestResult[]): void {
  const isCountableResult = (r: TestResult): boolean =>
    !!r.patternId && !!r.className && typeof r.phase === 'string'
    && r.verdict !== 'skipped'
    && r.verdict !== 'no_template'
    && r.verdict !== 'sandbox_disabled';

  const allComplete = results.every(r =>
    !!r.patternId && !!r.className && typeof r.phase === 'string'
    && typeof r.verdict === 'string'
  );
  if (!allComplete) return;

  for (const r of results) {
    if (!isCountableResult(r)) continue;
    const ok = r.passed;
    const ev = ok ? `gdb.${r.phase}.pass` : `gdb.${r.phase}.fail`;
    const detail = `${r.patternId} ${r.className} verdict=${r.verdict} ms=${r.durationMs}`
                 + (ok ? '' : ` — ${(r.message || '').slice(0, 200)}`);
    logEvent(userId, ev, detail);
  }
}

function summarize(results: TestResult[]): { total: number; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.verdict === 'skipped' || r.verdict === 'no_template' || r.verdict === 'sandbox_disabled') continue;
    if (r.passed) passed += 1;
    else failed += 1;
  }
  return { total: passed + failed, passed, failed };
}

// Saved-run path (kept for parity with the old contract).
router.post('/analysis/:runId/run-tests', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runIdNum = Number(req.params.runId);
    if (!Number.isFinite(runIdNum)) {
      res.status(400).json({ error: 'Invalid runId' });
      return;
    }
    const row = db.prepare('SELECT id, user_id, source_text, analysis_json FROM analysis_runs WHERE id = ?')
      .get(runIdNum) as RunTestsRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    if (row.user_id && row.user_id !== req.user?.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const analysis = JSON.parse(row.analysis_json) as {
      detectedPatterns?: DetectedPatternResult[];
      files?: Array<{ name: string; sourceText: string }>;
      classResolvedPatterns?: Record<string, string>;
    };
    // Saved-run full source = saved files joined when multi-file, else the
    // legacy single source_text column.
    const fullSource = (analysis.files && analysis.files.length > 0)
      ? analysis.files.map(f => f.sourceText).join('\n\n')
      : (row.source_text || '');
    const stdinText = typeof (req.body as { stdin?: unknown })?.stdin === 'string'
      ? String((req.body as { stdin: string }).stdin).slice(0, 64_000)
      : undefined;
    await handleRunTests(req, res, analysis.detectedPatterns || [], fullSource, analysis.files,
                         analysis.classResolvedPatterns || {}, stdinText);
  } catch (err) {
    next(err);
  }
});

// Pending-run path: works against an unsaved run via its pendingId.
router.post('/analysis/run-tests', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body || {}) as { pendingId?: unknown };
    const pendingId = typeof body.pendingId === 'string' ? body.pendingId : '';
    if (!pendingId) {
      res.status(400).json({ error: 'pendingId required' });
      return;
    }
    const pending = pendingRuns.get(pendingId);
    if (!pending || pending.expiresAt < Date.now()) {
      res.status(404).json({ error: 'Pending run not found or expired' });
      return;
    }
    if (pending.userId && pending.userId !== req.user?.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const pendingAnalysis = pending.analysis as {
      detectedPatterns?: DetectedPatternResult[];
      files?: Array<{ name: string; sourceText: string }>;
      classResolvedPatterns?: Record<string, string>;
    };
    // Pending-run path: the client may have resolved ambiguities in the SPA
    // since the analysis was first computed; accept an override map on the
    // request body and merge it over the snapshotted one.
    const bodyResolved = ((req.body as { classResolvedPatterns?: Record<string, string> })?.classResolvedPatterns) || {};
    const resolvedMap = { ...(pendingAnalysis.classResolvedPatterns || {}), ...bodyResolved };
    const patterns = pendingAnalysis.detectedPatterns || [];
    const fullSource = (pendingAnalysis.files && pendingAnalysis.files.length > 0)
      ? pendingAnalysis.files.map(f => f.sourceText).join('\n\n')
      : (pending.sourceText || '');
    const stdinText = typeof (req.body as { stdin?: unknown })?.stdin === 'string'
      ? String((req.body as { stdin: string }).stdin).slice(0, 64_000)
      : undefined;
    await handleRunTests(req, res, patterns, fullSource, pendingAnalysis.files, resolvedMap, stdinText);
  } catch (err) {
    next(err);
  }
});

// Server-Sent Events stream for a streaming run. The frontend opens this
// after kicking off /api/analysis/run-tests with a runId — each phase
// result lands as a discrete event, then a terminal `done` event closes
// the stream. Reconnects replay the buffered events from seq=0 so no
// verdict is lost across a flaky network drop.
//
// JWT is supplied via the `?token=` query parameter because the browser's
// EventSource API cannot attach Authorization headers. The token is
// validated with the same secret as jwtAuth — we do not accept it from
// the body and we do not log it.
router.get('/analysis/run-events/:runId', (req: Request, res: Response): void => {
  const runId = String(req.params.runId || '');
  if (!isValidRunId(runId)) {
    res.status(400).json({ error: 'Invalid runId' });
    return;
  }
  const tokenRaw = typeof req.query.token === 'string' ? req.query.token : '';
  if (!tokenRaw) {
    res.status(401).json({ error: 'token query param required' });
    return;
  }
  let userId: number;
  try {
    const decoded = jwt.verify(tokenRaw, process.env.JWT_SECRET || 'dev-secret') as { sub?: number; id?: number };
    const candidate = decoded.sub ?? decoded.id;
    if (typeof candidate !== 'number') throw new Error('token missing user id');
    userId = candidate;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  const rec = getRun(runId);
  if (!rec) {
    res.status(404).json({ error: 'Run not found or expired' });
    return;
  }
  if (rec.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable nginx response buffering on the AWS reverse proxy — without
  // this the nginx default of buffering N bytes before flushing to the
  // client makes SSE feel like polling.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeEvent = (ev: RunEvent): void => {
    res.write(`event: ${ev.type}\n`);
    res.write(`id: ${ev.seq}\n`);
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
    if (ev.type === 'done') {
      res.end();
    }
  };

  const heartbeat = setInterval(() => {
    // Comment-only line keeps the connection alive through proxies that
    // close idle TCP after ~30s. Browsers ignore SSE comments.
    res.write(': ping\n\n');
  }, 15_000);
  heartbeat.unref?.();

  const unsubscribe = subscribeRun(runId, writeEvent);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
