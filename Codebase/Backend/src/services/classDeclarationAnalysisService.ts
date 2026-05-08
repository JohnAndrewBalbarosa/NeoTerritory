import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import { sanitizeFilename } from '../utils/fileUtils';

// __dirname in tsx dev = src/services/ (4 up → project root)
// __dirname in compiled = dist/src/services/ (5 up → project root)
const ROOT4 = path.resolve(__dirname, '..', '..', '..', '..');
const ROOT5 = path.resolve(__dirname, '..', '..', '..', '..', '..');

function resolveDefaultBin(): string {
  const candidates = [
    path.join(ROOT4, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory.exe'),
    path.join(ROOT4, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory'),
    path.join(ROOT4, 'Codebase', 'Microservice', 'build', 'NeoTerritory.exe'),
    path.join(ROOT4, 'Codebase', 'Microservice', 'build', 'NeoTerritory'),
    path.join(ROOT4, 'Codebase', 'Microservice', 'build-linux', 'NeoTerritory'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory.exe'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'build', 'NeoTerritory.exe'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'build', 'NeoTerritory'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'build-linux', 'NeoTerritory'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function resolveDefaultCatalog(): string {
  const candidates = [
    path.join(ROOT4, 'Codebase', 'Microservice', 'pattern_catalog'),
    path.join(ROOT5, 'Codebase', 'Microservice', 'pattern_catalog'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

const DEFAULT_BIN = resolveDefaultBin();
const DEFAULT_CATALOG = resolveDefaultCatalog();

const STAGES = ['lexical', 'subtree', 'pattern_dispatch', 'hashing', 'output'];

interface AnalysisLog {
  sourceName: string;
  stagesCompleted: string[];
  stagesFailed: string[];
  notes: string[];
}

interface Diagnostic {
  code: string;
  message: string;
}

interface DocumentationAnchor {
  label: string;
  line: number;
  lexeme: string;
}

interface UnitTestTarget {
  function_hash: string | number;
  function_name: string;
  branch_kind: string;
  line: number;
}

export interface DetectedPatternResult {
  patternId: string;
  patternFamily: string;
  patternName: string;
  targetClassHash: string;
  className: string;
  fileName: string;
  classText: string;
  // Set when this tag was emitted via subclass propagation: names the
  // tagged parent class whose inheritance-driven pattern triggered this
  // child match. Empty string for regular per-class detections.
  parentClassName: string;
  documentationTargets: DocumentationAnchor[];
  unitTestTargets: UnitTestTarget[];
}

interface StageMetric {
  stage_name: string;
  items_processed?: number;
  milliseconds?: number;
}

export interface AnalysisResult {
  stage: string;
  diagnostics: Diagnostic[];
  detectedPatterns: DetectedPatternResult[];
  documentationTargets: DocumentationAnchor[];
  unitTestTargets: UnitTestTarget[];
  runDirectory?: string;
  outputDirectory?: string;
  stageMetrics?: StageMetric[];
  artifacts?: Record<string, unknown>;
  analysisLog: AnalysisLog;
}

interface MicroserviceReport {
  detected_patterns?: Array<{
    pattern_id: string;
    pattern_family: string;
    pattern_name: string;
    target_class_hash: string;
    class_name: string;
    file_name: string;
    class_text: string;
    parent_class_name?: string;
    documentation_targets?: DocumentationAnchor[];
    unit_test_targets?: UnitTestTarget[];
  }>;
  diagnostics?: Diagnostic[];
  stage_metrics?: StageMetric[];
  artifacts?: Record<string, unknown>;
}

function buildEmptyAnalysisLog(sourceName: string): AnalysisLog {
  return {
    sourceName,
    stagesCompleted: [],
    stagesFailed: [],
    notes: []
  };
}

function rejectWithDiagnostic(stage: string, diagnostics: Diagnostic[], sourceName: string): AnalysisResult {
  return {
    stage,
    diagnostics,
    detectedPatterns: [],
    documentationTargets: [],
    unitTestTargets: [],
    analysisLog: {
      ...buildEmptyAnalysisLog(sourceName),
      stagesFailed: [stage]
    }
  };
}

export function resolveBinaryPath(): string {
  return process.env.NEOTERRITORY_BIN || DEFAULT_BIN;
}

export function resolveCatalogPath(): string {
  return process.env.NEOTERRITORY_CATALOG || DEFAULT_CATALOG;
}

function makeTempRunDir(): string {
  const base = path.join(os.tmpdir(), 'neoterritory-run-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function writeSourceToTemp(runDir: string, sourceName: string, code: string): string {
  const raw = String(sourceName || '').slice(0, 255);
  // Reject obvious traversal/injection before passing the name to a subprocess.
  if (/[\\/]/.test(raw) || /[\x00-\x1f]/.test(raw)) {
    throw new Error('Invalid source filename: contains path separators or control characters');
  }
  const safeName = sanitizeFilename(raw) || 'snippet.cpp';
  const filePath = path.join(runDir, safeName);
  fs.writeFileSync(filePath, code, 'utf8');
  return filePath;
}

interface MicroserviceExec {
  spawnError: Error | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runMicroservice(opts: { binaryPath: string; catalogPath: string; outputDir: string; sourcePath: string }): MicroserviceExec {
  const args = [
    '--catalog', opts.catalogPath,
    '--output',  opts.outputDir,
    opts.sourcePath
  ];

  const result = spawnSync(opts.binaryPath, args, {
    encoding: 'utf8',
    timeout:  30000,
    windowsHide: true
  });

  return {
    spawnError: result.error || null,
    exitCode:   result.status,
    stdout:     result.stdout || '',
    stderr:     result.stderr || ''
  };
}

function readReport(outputDir: string): MicroserviceReport | null {
  const reportPath = path.join(outputDir, 'report.json');
  if (!fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MicroserviceReport;
}

export function analyzeClassDeclaration(input: { sourceName: string; code: string }): AnalysisResult {
  const { sourceName, code } = input;
  if (typeof code !== 'string' || !code.trim()) {
    return rejectWithDiagnostic('lexical', [
      { code: 'empty_input', message: 'No source text was provided.' }
    ], sourceName || 'unknown');
  }

  const binaryPath  = resolveBinaryPath();
  const catalogPath = resolveCatalogPath();

  if (!fs.existsSync(binaryPath)) {
    return {
      stage: 'lexical',
      diagnostics: [
        {
          code: 'microservice_unavailable',
          message: `NeoTerritory binary not found at ${binaryPath}. Build it from Codebase/Microservice or set NEOTERRITORY_BIN.`
        }
      ],
      detectedPatterns: [],
      documentationTargets: [],
      unitTestTargets: [],
      analysisLog: {
        ...buildEmptyAnalysisLog(sourceName),
        stagesFailed: ['lexical'],
        notes: ['Microservice binary missing; structural detection skipped.']
      }
    };
  }

  if (!fs.existsSync(catalogPath)) {
    return {
      stage: 'lexical',
      diagnostics: [
        {
          code: 'catalog_unavailable',
          message: `Pattern catalog directory not found at ${catalogPath}. Set NEOTERRITORY_CATALOG.`
        }
      ],
      detectedPatterns: [],
      documentationTargets: [],
      unitTestTargets: [],
      analysisLog: {
        ...buildEmptyAnalysisLog(sourceName),
        stagesFailed: ['lexical']
      }
    };
  }

  const runDir = makeTempRunDir();
  const sourcePath = writeSourceToTemp(runDir, sourceName || 'snippet.cpp', code);
  const outputDir  = path.join(runDir, 'output');

  const exec = runMicroservice({ binaryPath, catalogPath, outputDir, sourcePath });

  if (exec.spawnError) {
    return rejectWithDiagnostic('subtree', [
      { code: 'microservice_spawn_error', message: String(exec.spawnError.message || exec.spawnError) }
    ], sourceName);
  }

  // Read the report first — the microservice writes it before exiting,
  // and on some platforms it exits with a non-zero code (SIGSEGV / 139)
  // after a successful analysis. Prefer a valid report over a clean exit.
  const report = readReport(outputDir);

  if (exec.exitCode !== 0 && !report) {
    return rejectWithDiagnostic('subtree', [
      {
        code: 'microservice_exit_nonzero',
        message: `Exit code ${exec.exitCode}. stderr: ${(exec.stderr || '').slice(0, 500)}`
      }
    ], sourceName);
  }

  if (!report) {
    return rejectWithDiagnostic('output', [
      { code: 'report_missing', message: 'Microservice did not produce a report.json.' }
    ], sourceName);
  }

  const detectedPatterns: DetectedPatternResult[] = (report.detected_patterns || []).map((tag) => ({
    patternId:           tag.pattern_id,
    patternFamily:       tag.pattern_family,
    patternName:         tag.pattern_name,
    targetClassHash:     tag.target_class_hash,
    className:           tag.class_name,
    fileName:            tag.file_name,
    classText:           tag.class_text,
    parentClassName:     tag.parent_class_name || '',
    documentationTargets: tag.documentation_targets || [],
    unitTestTargets:      tag.unit_test_targets || []
  }));

  if (detectedPatterns.length === 0) {
    console.log(`[NT] detected  (none)  file=${sourceName}`);
  } else {
    for (const p of detectedPatterns) {
      console.log(`[NT] detected  pattern=${p.patternName}  class=${p.className}  file=${p.fileName || sourceName}`);
    }
  }

  return {
    stage: 'output',
    diagnostics: report.diagnostics || [],
    detectedPatterns,
    documentationTargets: detectedPatterns.flatMap((p) => p.documentationTargets),
    unitTestTargets:      detectedPatterns.flatMap((p) => p.unitTestTargets),
    runDirectory: runDir,
    outputDirectory: outputDir,
    stageMetrics: report.stage_metrics || [],
    artifacts: report.artifacts || {},
    analysisLog: {
      ...buildEmptyAnalysisLog(sourceName),
      stagesCompleted: STAGES.slice(),
      notes: [`Microservice run output at ${outputDir}`]
    }
  };
}
