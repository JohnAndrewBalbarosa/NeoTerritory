// Orchestrator for the panelist AI-sample helper.
//
// Wires the decoupled pieces together: read settings prompts -> read the
// pattern JSON (patternCatalogReader) -> compose the prompt (pure injector)
// -> call the configured AI provider for raw C++ -> strip fences. Emits
// structured monitoring records (kept in a small ring buffer) so the operator
// can spot anomalies (provider errors, slow calls, empty output) during the
// defense without combing logs.
import { pickProvider, type ProviderChoice } from '../aiDocumentationService';
import { getSetting } from '../../db/appSettings';
import { readPatternJson } from './patternCatalogReader';
import { injectSamplePrompt } from './aiSamplePromptInjector';

const PROVIDER_TIMEOUT_MS = 30000;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_OUTPUT_TOKENS = 2048;

export interface AiSampleResult {
  ok: boolean;
  code?: string;
  provider?: string;
  model?: string;
  durationMs: number;
  reason?: string; // failure reason code when ok=false
  detail?: string; // short provider error detail
}

// ----- monitoring ring buffer -----
export interface AiSampleMonitorEntry {
  at: string; // ISO timestamp
  patternId: string;
  provider: string | null;
  model: string | null;
  ok: boolean;
  durationMs: number;
  reason?: string;
  codeChars?: number;
}
const MONITOR_CAP = 50;
const monitor: AiSampleMonitorEntry[] = [];
function record(entry: AiSampleMonitorEntry): void {
  monitor.unshift(entry);
  if (monitor.length > MONITOR_CAP) monitor.length = MONITOR_CAP;
  // Structured one-line log for server-side anomaly scanning.
  console.log(
    `[ai-sample] pattern=${entry.patternId} provider=${entry.provider ?? 'none'} ` +
    `ok=${entry.ok} ms=${entry.durationMs} chars=${entry.codeChars ?? 0}` +
    (entry.reason ? ` reason=${entry.reason}` : ''),
  );
}
export function getAiSampleMonitor(): ReadonlyArray<AiSampleMonitorEntry> {
  return monitor;
}

// Strip Markdown code fences and stray prose the model may add despite the
// "no fences" instruction, so the editor receives clean C++.
function stripFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:c\+\+|cpp|c)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : t).trim();
}

async function callProviderForText(choice: ProviderChoice, system: string, user: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  try {
    if (choice.provider === 'anthropic') {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': choice.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: choice.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`anthropic_http_${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      return text;
    }
    // gemini
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(choice.model)}:generateContent?key=${encodeURIComponent(choice.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'system', parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.3 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`gemini_http_${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  } finally {
    clearTimeout(timer);
  }
}

// Generate a C++ sample for the given catalog pattern id. Pure-ish entry
// point used by the route; all failure modes return a typed result (never
// throw) so the route can map them to clean HTTP responses.
export async function generateAiSample(patternId: string): Promise<AiSampleResult> {
  const started = Date.now();
  const fail = (reason: string, detail?: string, provider: string | null = null, model: string | null = null): AiSampleResult => {
    const durationMs = Date.now() - started;
    record({ at: new Date().toISOString(), patternId, provider, model, ok: false, durationMs, reason });
    return { ok: false, reason, detail, durationMs };
  };

  const patternJson = readPatternJson(patternId);
  if (!patternJson) return fail('unknown_pattern');

  const choice = pickProvider();
  if (!choice) return fail('ai_provider_not_configured');

  const { system, user } = injectSamplePrompt({
    systemPrompt: getSetting('ai_sample_system_prompt'),
    injectionInstruction: getSetting('ai_sample_injection_instruction'),
    patternJson,
    patternName: typeof patternJson.pattern_name === 'string' ? patternJson.pattern_name : undefined,
  });

  let raw: string;
  try {
    raw = await callProviderForText(choice, system, user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`${choice.provider}_call_failed`, msg.slice(0, 300), choice.provider, choice.model);
  }

  const code = stripFences(raw);
  if (!code) return fail('empty_ai_output', undefined, choice.provider, choice.model);

  const durationMs = Date.now() - started;
  record({
    at: new Date().toISOString(), patternId, provider: choice.provider, model: choice.model,
    ok: true, durationMs, codeChars: code.length,
  });
  return { ok: true, code, provider: choice.provider, model: choice.model, durationMs };
}
