const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_BIN = process.platform === 'win32'
  ? path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'build', 'NeoTerritory.exe')
  : path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'build', 'NeoTerritory');
const DEFAULT_CATALOG = path.join(PROJECT_ROOT, 'Codebase', 'Microservice', 'pattern_catalog');

const STAGES = ['lexical', 'subtree', 'pattern_dispatch', 'hashing', 'output'];

function buildEmptyAnalysisLog(sourceName) {
  return {
    sourceName,
    stagesCompleted: [],
    stagesFailed: [],
    notes: []
  };
}

function rejectWithDiagnostic(stage, diagnostics, sourceName) {
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

function resolveBinaryPath() {
  return process.env.NEOTERRITORY_BIN || DEFAULT_BIN;
}

function resolveCatalogPath() {
  return process.env.NEOTERRITORY_CATALOG || DEFAULT_CATALOG;
}

function makeTempRunDir() {
  const base = path.join(os.tmpdir(), 'neoterritory-run-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function writeSourceToTemp(runDir, sourceName, code) {
  const safeName = sourceName.replace(/[^A-Za-z0-9_.\-]/g, '_') || 'snippet.cpp';
  const filePath = path.join(runDir, safeName);
  fs.writeFileSync(filePath, code, 'utf8');
  return filePath;
}

function runMicroservice({ binaryPath, catalogPath, outputDir, sourcePath }) {
  const args = [
    '--catalog', catalogPath,
    '--output',  outputDir,
    sourcePath
  ];

  const result = spawnSync(binaryPath, args, {
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

function readReport(outputDir) {
  const reportPath = path.join(outputDir, 'report.json');
  if (!fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function analyzeClassDeclaration({ sourceName, code }) {
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

  if (exec.exitCode !== 0) {
    return rejectWithDiagnostic('subtree', [
      {
        code: 'microservice_exit_nonzero',
        message: `Exit code ${exec.exitCode}. stderr: ${(exec.stderr || '').slice(0, 500)}`
      }
    ], sourceName);
  }

  const report = readReport(outputDir);
  if (!report) {
    return rejectWithDiagnostic('output', [
      { code: 'report_missing', message: 'Microservice did not produce a report.json.' }
    ], sourceName);
  }

  const detectedPatterns = (report.detected_patterns || []).map(tag => ({
    patternId:           tag.pattern_id,
    patternFamily:       tag.pattern_family,
    patternName:         tag.pattern_name,
    targetClassHash:     tag.target_class_hash,
    className:           tag.class_name,
    fileName:            tag.file_name,
    classText:           tag.class_text,
    documentationTargets: tag.documentation_targets || [],
    unitTestTargets:      tag.unit_test_targets || []
  }));

  return {
    stage: 'output',
    diagnostics: report.diagnostics || [],
    detectedPatterns,
    documentationTargets: detectedPatterns.flatMap(p => p.documentationTargets),
    unitTestTargets:      detectedPatterns.flatMap(p => p.unitTestTargets),
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

module.exports = {
  analyzeClassDeclaration
};
