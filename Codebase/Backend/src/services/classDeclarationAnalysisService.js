const path = require('path');
const fs = require('fs');

const STAGES = ['lexical', 'subtree', 'cross_reference', 'target_selection'];

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
    detectedPattern: null,
    documentationTargets: [],
    unitTestTargets: [],
    analysisLog: {
      ...buildEmptyAnalysisLog(sourceName),
      stagesFailed: [stage]
    }
  };
}

function analyzeClassDeclaration({ sourceName, code, microserviceOutputDir }) {
  if (typeof code !== 'string' || !code.trim()) {
    return rejectWithDiagnostic('lexical', [
      { code: 'empty_input', message: 'No source text was provided.' }
    ], sourceName || 'unknown');
  }

  if (microserviceOutputDir && fs.existsSync(microserviceOutputDir)) {
    const reportPath = path.join(microserviceOutputDir, 'report.json');
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        return {
          stage: 'target_selection',
          diagnostics: [],
          detectedPattern: report.detected_patterns?.[0]?.pattern_id || null,
          documentationTargets: report.documentation_targets || [],
          unitTestTargets: report.unit_test_targets || [],
          analysisLog: {
            sourceName,
            stagesCompleted: STAGES.slice(),
            stagesFailed: [],
            notes: ['Loaded analysis from microservice report.json']
          }
        };
      } catch (err) {
        return rejectWithDiagnostic('subtree', [
          { code: 'report_parse_error', message: err.message }
        ], sourceName);
      }
    }
  }

  return {
    stage: 'lexical',
    diagnostics: [
      {
        code: 'microservice_not_yet_invoked',
        message: 'Pure-algorithm microservice has not produced a report.json for this run yet.'
      }
    ],
    detectedPattern: null,
    documentationTargets: [],
    unitTestTargets: [],
    analysisLog: {
      ...buildEmptyAnalysisLog(sourceName),
      notes: ['classDeclarationAnalysisService is awaiting microservice spawn integration.']
    }
  };
}

module.exports = {
  analyzeClassDeclaration
};
