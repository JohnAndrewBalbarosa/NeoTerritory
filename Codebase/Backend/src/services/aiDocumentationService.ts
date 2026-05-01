const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

// "Educator" voice: optimized for novice C++ developers. The studio renders
// these fields directly in PatternCards next to the rank bar, so the tone has
// to be plain-English and the content has to be specific to *this* class —
// not generic textbook copy.
const SYSTEM_PROMPT = [
  'You are explaining a detected design pattern to a junior C++ developer who has never seen this codebase.',
  'You will receive: a structural verdict (pattern id) emitted by a deterministic C++ matcher,',
  'the class declaration + implementation text, captured documentation anchors, and unit-test targets.',
  '',
  'Your job:',
  '1. Confirm or reclassify the structural verdict. Several patterns are intentionally co-emit',
  '   (Builder vs Method Chaining; Adapter vs Proxy vs Decorator). Pick the most likely role',
  '   for this class given its full text. Set "verdict" to "confirmed" or "reclassified".',
  '2. Write three short fields aimed at a beginner:',
  '   - "explanation": 1-2 sentences in plain English saying what this pattern does. Avoid jargon.',
  '     If a term is unavoidable (e.g. "polymorphism"), define it inline in parentheses.',
  '   - "why_this_fired": one sentence pointing at the *specific* shape in their code that matched.',
  '     Reference real identifiers from the class (member names, method names) so it feels concrete.',
  '   - "study_hint": one sentence telling them which method or member to read first to "see" the pattern.',
  '3. For each documentation anchor: write a one-paragraph note in beginner voice. Reference the',
  '   anchor label and line. Explain why that line matters for the chosen pattern, in plain terms.',
  '4. For each unit-test target: one beginner-voice sentence describing what behavior to verify.',
  '   Reference the function name and branch_kind.',
  '',
  'Tone rules:',
  '- Say "the class wraps another object" not "the class composes a delegate".',
  '- Say "called from outside" not "exposed as a public ABI".',
  '- Be concrete to *this* code; do not output generic textbook definitions.',
  '',
  'Return a single JSON object. No prose, no code fences. Schema:',
  '{',
  '  "verdict": "confirmed" | "reclassified",',
  '  "final_pattern_id": "<pattern id>",',
  '  "rationale": "<1-3 sentence justification>",',
  '  "explanation": "<beginner-voice 1-2 sentence summary of the pattern>",',
  '  "why_this_fired": "<one sentence referencing concrete identifiers from this class>",',
  '  "study_hint": "<one sentence pointing at a specific method/member to read first>",',
  '  "documentationByTarget": { "<anchor label>": "<beginner-voice paragraph>" },',
  '  "unitTestPlanByTarget": { "<function_hash as string>": "<beginner-voice test note>" }',
  '}'
].join('\n');

interface DocumentationAnchor {
  label: string;
  line: number;
  lexeme: string;
}

interface UnitTestTargetInput {
  function_hash: string | number;
  function_name: string;
  branch_kind: string;
  line: number;
}

interface AiInput {
  detectedPattern?: string;
  language?: string;
  className?: string;
  fileName?: string;
  classText?: string;
  documentationTargets?: DocumentationAnchor[];
  unitTestTargets?: UnitTestTargetInput[];
}

interface AiPayload {
  task: string;
  detectedPattern: string | null;
  language: string;
  className: string;
  fileName: string;
  classText: string;
  documentationTargets: DocumentationAnchor[];
  unitTestTargets: UnitTestTargetInput[];
}

interface ProviderMetadata {
  id?: string;
  model?: string;
  stop_reason?: string;
}

export interface PatternEducationOut {
  explanation: string;
  whyThisFired: string;
  studyHint: string;
}

export interface AiResult {
  status: 'generated' | 'failed' | 'skipped' | 'pending_provider';
  reason?: string;
  verdict?: string | null;
  finalPatternId?: string | null;
  rationale?: string;
  education?: PatternEducationOut | null;
  documentationByTarget: Record<string, string>;
  unitTestPlanByTarget: Record<string, string>;
  providerMetadata?: ProviderMetadata | null;
  providerError?: string;
  payload?: AiPayload;
}

export function buildAiPayload(input: AiInput): AiPayload {
  return {
    task: 'document_detected_design_pattern_code',
    detectedPattern: input.detectedPattern || null,
    language: input.language || 'cpp',
    className: input.className || '',
    fileName: input.fileName || '',
    classText: input.classText || '',
    documentationTargets: Array.isArray(input.documentationTargets) ? input.documentationTargets : [],
    unitTestTargets: Array.isArray(input.unitTestTargets) ? input.unitTestTargets : []
  };
}

export function normalizeAiResult(rawResult: unknown): AiResult {
  if (!rawResult || typeof rawResult !== 'object') {
    return {
      status: 'failed',
      reason: 'empty_ai_result',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }
  const raw = rawResult as Partial<AiResult>;
  return {
    status: raw.status || 'generated',
    documentationByTarget: raw.documentationByTarget || {},
    unitTestPlanByTarget: raw.unitTestPlanByTarget || {},
    providerMetadata: raw.providerMetadata || null
  };
}

function buildUserMessage(payload: AiPayload): string {
  const lines: string[] = [];
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
  payload.documentationTargets.forEach((anchor) => {
    lines.push(`- label="${anchor.label}" line=${anchor.line} lexeme="${anchor.lexeme}"`);
  });
  lines.push('');
  lines.push('=== Unit-test targets ===');
  payload.unitTestTargets.forEach((target) => {
    lines.push(`- function_hash=${target.function_hash} name="${target.function_name}" kind="${target.branch_kind}" line=${target.line}`);
  });
  lines.push('');
  lines.push('Return only the JSON object specified in the system prompt. No code fences.');
  return lines.join('\n');
}

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse {
  id?: string;
  model?: string;
  stop_reason?: string;
  content?: AnthropicTextBlock[];
}

interface ParsedAi {
  verdict?: string;
  final_pattern_id?: string;
  rationale?: string;
  explanation?: string;
  why_this_fired?: string;
  study_hint?: string;
  documentationByTarget?: Record<string, string>;
  unitTestPlanByTarget?: Record<string, string>;
}

function extractJsonFromContent(content: AnthropicTextBlock[] | undefined): ParsedAi | null {
  if (!Array.isArray(content)) return null;
  const textBlock = content.find((block) => block.type === 'text' && typeof block.text === 'string');
  if (!textBlock || !textBlock.text) return null;
  const text = textBlock.text.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? (fenceMatch[1] ?? '').trim() : text;
  try {
    return JSON.parse(candidate) as ParsedAi;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace  = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as ParsedAi;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callAnthropicMessages(apiKey: string, model: string, payload: AiPayload): Promise<AiResult> {
  const body = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserMessage(payload) }
    ]
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);

  let response: Response;
  try {
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type':       'application/json',
          'x-api-key':          apiKey,
          'anthropic-version':  ANTHROPIC_VERSION
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    } catch (err: unknown) {
      if (err && (err as { name?: string }).name === 'AbortError') {
        return {
          status: 'failed',
          reason: 'anthropic_timeout',
          providerError: 'Anthropic request aborted after 30s timeout',
          documentationByTarget: {},
          unitTestPlanByTarget: {}
        };
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }

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

  const data = (await response.json()) as AnthropicResponse;
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

  const education: PatternEducationOut | null =
    (parsed.explanation || parsed.why_this_fired || parsed.study_hint)
      ? {
          explanation:  parsed.explanation || '',
          whyThisFired: parsed.why_this_fired || '',
          studyHint:    parsed.study_hint || ''
        }
      : null;

  return {
    status: 'generated',
    verdict: parsed.verdict || null,
    finalPatternId: parsed.final_pattern_id || payload.detectedPattern || null,
    rationale: parsed.rationale || '',
    education,
    documentationByTarget: parsed.documentationByTarget || {},
    unitTestPlanByTarget: parsed.unitTestPlanByTarget || {},
    providerMetadata: { id: data.id, model: data.model, stop_reason: data.stop_reason }
  };
}

export async function generateDocumentation(input: AiInput): Promise<AiResult> {
  const payload = buildAiPayload(input);

  if (!payload.documentationTargets.length && !payload.unitTestTargets.length) {
    return {
      status: 'skipped',
      reason: 'no_targets',
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      reason: 'anthropic_call_threw',
      providerError: msg.slice(0, 500),
      documentationByTarget: {},
      unitTestPlanByTarget: {}
    };
  }
}
