// Provider env-var schema (D32, revised): PLANNER_* names are canonical.
// Legacy fallbacks (GEMINI_*, ANTHROPIC_*) are read only if the canonical
// names are absent, so existing dev .env files don't break overnight.
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL    = 'gemini-2.0-flash';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_TOP_P       = 0.95;

function readPlannerConfig() {
  const apiKey = process.env.PLANNER_API_KEY || process.env.GEMINI_API_KEY || '';
  const model  = process.env.PLANNER_MODEL   || process.env.GEMINI_MODEL   || DEFAULT_MODEL;
  const provider = (process.env.PLANNER_PROVIDER || 'gemini').toLowerCase();
  const maxOutputTokens = Number(process.env.PLANNER_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_TOKENS;
  const temperature     = clampNumber(process.env.PLANNER_TEMPERATURE, DEFAULT_TEMPERATURE, 0, 2);
  const topP            = clampNumber(process.env.PLANNER_TOP_P,       DEFAULT_TOP_P,       0, 1);
  return { apiKey, model, provider, maxOutputTokens, temperature, topP };
}

function clampNumber(raw, def, lo, hi) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

function isGemmaModel(model) {
  return /^gemma/i.test(String(model || ''));
}

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

function extractTextFromGemini(data) {
  const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  if (!candidate) return null;
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) return null;
  // Gemma reasoning models emit a "thought" part followed by the actual answer.
  // Skip parts marked thought:true and prefer the last non-thought text part.
  const answerParts = parts.filter(p => typeof p.text === 'string' && p.thought !== true);
  if (answerParts.length) return answerParts[answerParts.length - 1].text;
  const anyText = parts.find(p => typeof p.text === 'string');
  return anyText ? anyText.text : null;
}

function parseJsonText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
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

async function callGemini(cfg, payload) {
  const { apiKey, model, maxOutputTokens, temperature, topP } = cfg;
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const userText = buildUserMessage(payload);
  // Gemma models on the Gemini API don't accept systemInstruction — inline it.
  const useSystemInstruction = !isGemmaModel(model);
  const body = useSystemInstruction
    ? {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature, topP, maxOutputTokens,
          responseMimeType: 'application/json'
        }
      }
    : {
        contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${userText}` }] }],
        generationConfig: {
          temperature, topP, maxOutputTokens,
          responseMimeType: 'application/json'
        }
      };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return {
      status: 'failed',
      reason: `gemini_http_${response.status}`,
      providerError: errorText.slice(0, 500),
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  const data = await response.json();
  const text = extractTextFromGemini(data);
  const parsed = parseJsonText(text);

  if (!parsed) {
    return {
      status: 'failed',
      reason: 'unparseable_ai_response',
      documentationByTarget: {},
      unitTestPlanByTarget: {},
      providerMetadata: { model: data.modelVersion || model, finishReason: data.candidates?.[0]?.finishReason }
    };
  }

  return {
    status: 'generated',
    verdict: parsed.verdict || null,
    finalPatternId: parsed.final_pattern_id || payload.detectedPattern || null,
    rationale: parsed.rationale || '',
    documentationByTarget: parsed.documentationByTarget || {},
    unitTestPlanByTarget: parsed.unitTestPlanByTarget || {},
    providerMetadata: { model: data.modelVersion || model, finishReason: data.candidates?.[0]?.finishReason }
  };
}

function isPlannerConfigured() {
  const cfg = readPlannerConfig();
  return Boolean(cfg.apiKey);
}

function getPlannerStatus() {
  const cfg = readPlannerConfig();
  return {
    provider: cfg.provider,
    model: cfg.model,
    configured: Boolean(cfg.apiKey)
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

  const cfg = readPlannerConfig();
  if (!cfg.apiKey) {
    return {
      status: 'pending_provider',
      reason: 'ai_provider_not_configured',
      payload,
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  try {
    return await callGemini(cfg, payload);
  } catch (err) {
    return {
      status: 'failed',
      reason: 'gemini_call_threw',
      providerError: String(err && err.message ? err.message : err).slice(0, 500),
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }
}

module.exports = {
  buildAiPayload,
  normalizeAiResult,
  generateDocumentation,
  isPlannerConfigured,
  getPlannerStatus
};
