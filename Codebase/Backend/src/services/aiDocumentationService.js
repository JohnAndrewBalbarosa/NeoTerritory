const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

const SYSTEM_PROMPT = [
  'You are a code-documentation reviewer for a structural pattern detector.',
  'You will receive: a structural verdict (pattern id) emitted by a deterministic C++ matcher,',
  'the class declaration + implementation text, captured documentation anchors, and unit-test targets.',
  '',
  'Your job:',
  '1. Confirm or reclassify the structural verdict. Several patterns are intentionally co-emit',
  '   (Builder vs Method Chaining; Adapter vs Proxy vs Decorator). Pick the most likely role',
  '   for this class given its full text. Set "verdict" to "confirmed" or "reclassified".',
  '2. Write a concise documentation paragraph for each documentation anchor. Reference the',
  '   anchor label and the line. Explain why that anchor matters for the chosen pattern.',
  '3. Write a one-sentence test-design note for each unit-test target. Reference the function',
  '   name and branch_kind. Describe what behavior the test should verify.',
  '',
  'Return a single JSON object. No prose, no code fences. Schema:',
  '{',
  '  "verdict": "confirmed" | "reclassified",',
  '  "final_pattern_id": "<pattern id>",',
  '  "rationale": "<1-3 sentence justification>",',
  '  "documentationByTarget": { "<anchor label>": "<documentation paragraph>" },',
  '  "unitTestPlanByTarget": { "<function_hash as string>": "<test design note>" }',
  '}'
].join('\n');

function buildAiPayload({
  detectedPattern,
  language,
  documentationTargets,
  unitTestTargets,
  className,
  fileName,
  classText
}) {
  return {
    task: 'document_detected_design_pattern_code',
    detectedPattern: detectedPattern || null,
    language: language || 'cpp',
    className: className || '',
    fileName: fileName || '',
    classText: classText || '',
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

function buildUserMessage(payload) {
  const lines = [];
  lines.push(`Structural verdict: ${payload.detectedPattern || 'unknown'}`);
  lines.push(`Class name: ${payload.className}`);
  lines.push(`File: ${payload.fileName}`);
  lines.push('');
  lines.push('=== Class text (declaration + implementation) ===');
  lines.push('```cpp');
  lines.push(payload.classText.length > 8000
    ? payload.classText.slice(0, 8000) + '\n// ... slice truncated for prompt budget'
    : payload.classText);
  lines.push('```');
  lines.push('');
  lines.push('=== Documentation anchors ===');
  payload.documentationTargets.forEach(anchor => {
    lines.push(`- label="${anchor.label}" line=${anchor.line} lexeme="${anchor.lexeme}"`);
  });
  lines.push('');
  lines.push('=== Unit-test targets ===');
  payload.unitTestTargets.forEach(target => {
    lines.push(`- function_hash=${target.function_hash} name="${target.function_name}" kind="${target.branch_kind}" line=${target.line}`);
  });
  lines.push('');
  lines.push('Return only the JSON object specified in the system prompt. No code fences.');
  return lines.join('\n');
}

function extractJsonFromContent(content) {
  if (!Array.isArray(content)) return null;
  const textBlock = content.find(block => block.type === 'text' && typeof block.text === 'string');
  if (!textBlock) return null;
  const text = textBlock.text.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace  = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callAnthropicMessages(apiKey, model, payload) {
  const body = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserMessage(payload) }
    ]
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type':       'application/json',
      'x-api-key':          apiKey,
      'anthropic-version':  ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return {
      status: 'failed',
      reason: `anthropic_http_${response.status}`,
      providerError: errorText.slice(0, 500),
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  const data = await response.json();
  const parsed = extractJsonFromContent(data.content);

  if (!parsed) {
    return {
      status: 'failed',
      reason: 'unparseable_ai_response',
      documentationByTarget: {},
      unitTestPlanByTarget: {},
      providerMetadata: { id: data.id, model: data.model, stop_reason: data.stop_reason }
    };
  }

  return {
    status: 'generated',
    verdict: parsed.verdict || null,
    finalPatternId: parsed.final_pattern_id || payload.detectedPattern || null,
    rationale: parsed.rationale || '',
    documentationByTarget: parsed.documentationByTarget || {},
    unitTestPlanByTarget: parsed.unitTestPlanByTarget || {},
    providerMetadata: { id: data.id, model: data.model, stop_reason: data.stop_reason }
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

  const $1***REDACTED***$2;
  if (!apiKey) {
    return {
      status: 'pending_provider',
      reason: 'ai_provider_not_configured',
      payload,
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    return await callAnthropicMessages(apiKey, model, payload);
  } catch (err) {
    return {
      status: 'failed',
      reason: 'anthropic_call_threw',
      providerError: String(err && err.message ? err.message : err).slice(0, 500),
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }
}

module.exports = {
  buildAiPayload,
  normalizeAiResult,
  generateDocumentation
};
