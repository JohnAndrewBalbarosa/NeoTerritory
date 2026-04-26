function buildAiPayload({
  detectedPattern,
  language,
  documentationTargets,
  unitTestTargets
}) {
  return {
    task: 'document_detected_design_pattern_code',
    detectedPattern: detectedPattern || null,
    language: language || 'cpp',
    documentationTargets: Array.isArray(documentationTargets) ? documentationTargets : [],
    unitTestTargets: Array.isArray(unitTestTargets) ? unitTestTargets : []
  };
}

function normalizeAiResult(rawResult) {
  if (!rawResult || typeof rawResult !== 'object') {
    return {
      status: 'failed',
      reason: 'empty_ai_result',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  return {
    status: rawResult.status || 'generated',
    documentationByTarget: rawResult.documentationByTarget || {},
    unitTestPlanByTarget: rawResult.unitTestPlanByTarget || {},
    providerMetadata: rawResult.providerMetadata || null
  };
}

async function generateDocumentation(input) {
  const payload = buildAiPayload(input);

  if (!payload.documentationTargets.length && !payload.unitTestTargets.length) {
    return {
      status: 'skipped',
      reason: 'no_targets',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  return {
    status: 'pending_provider',
    reason: 'ai_provider_not_configured',
    payload,
    documentationByTarget: {},
    unitTestPlanByTarget: {}
  };
}

module.exports = {
  buildAiPayload,
  normalizeAiResult,
  generateDocumentation
};
