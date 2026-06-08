import { pickProvider } from './aiDocumentationService';
import { buildPlannerDigest, type LearningModulePlannerEntry } from './learningModuleCatalog';

export interface FeatureReleasePlannerFlag {
  key: string;
  label: string;
  description: string;
}

export interface FeatureReleaseToggleDecision {
  key: string;
  label: string;
  enabled: boolean;
  reason: string;
  matchedModules: string[];
  matchedTopics: string[];
}

export interface FeatureReleaseLearningScope {
  moduleId: string;
  title: string;
  category: string;
  sections: string[];
  topics: string[];
  reason: string;
}

export interface FeatureReleasePlan {
  schemaVersion: 'feature-release-plan-v1';
  source: 'ai' | 'heuristic';
  summary: string;
  toggles: FeatureReleaseToggleDecision[];
  requiredLearning: FeatureReleaseLearningScope[];
}

interface PlannerInput {
  prompt: string;
  flags: FeatureReleasePlannerFlag[];
}

const DEFAULT_MAX_TOKENS = 4096;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = [
  'You are an admin-side planning assistant for a project learning system.',
  'You receive an architectural/business prompt plus a JSON catalog of learning modules.',
  'Your job is to decide which feature-release toggles should be ON or OFF, and which',
  'learning modules, sections, and topics are required for the project.',
  '',
  'Rules:',
  '- Return one JSON object only. No prose, no code fences, no markdown.',
  '- Use the provided feature flags exactly as given. Every flag must appear in toggles.',
  '- Default all unspecified items to enabled=false with a short explanation.',
  '- Decide required learning by matching the prompt against module titles, sections, and topics.',
  '- Prefer a narrow scope. Do not enable unrelated surfaces.',
  '- When the prompt is vague, keep more toggles OFF and fewer modules required.',
  '',
  'Return this schema exactly:',
  '{',
  '  "summary": "string",',
  '  "toggles": [',
  '    {',
  '      "key": "string",',
  '      "label": "string",',
  '      "enabled": true,',
  '      "reason": "string",',
  '      "matchedModules": ["string"],',
  '      "matchedTopics": ["string"]',
  '    }',
  '  ],',
  '  "requiredLearning": [',
  '    {',
  '      "moduleId": "string",',
  '      "title": "string",',
  '      "category": "string",',
  '      "sections": ["string"],',
  '      "topics": ["string"],',
  '      "reason": "string"',
  '    }',
  '  ]',
  '}'
].join('\n');

interface ParsedPlan {
  summary?: string;
  toggles?: Array<Partial<FeatureReleaseToggleDecision> & { key?: string; label?: string }>;
  requiredLearning?: Array<Partial<FeatureReleaseLearningScope> & { moduleId?: string; title?: string; category?: string }>;
}

function safeJsonParse(text: string): ParsedPlan | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ParsedPlan;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1)) as ParsedPlan;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractTokens(text: string): string[] {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4),
  ));
}

function scoreOverlap(haystack: string, needles: string[]): number {
  const tokens = extractTokens(haystack);
  let score = 0;
  for (const n of needles) {
    if (tokens.includes(n.toLowerCase())) score += 1;
  }
  return score;
}

function heuristicPlan(input: PlannerInput, digest: LearningModulePlannerEntry[]): FeatureReleasePlan {
  const prompt = input.prompt.toLowerCase();
  const promptTokens = extractTokens(prompt);
  const toggles = input.flags.map((flag) => {
    const labelTokens = extractTokens(`${flag.key} ${flag.label} ${flag.description}`);
    const score = scoreOverlap(prompt, labelTokens);
    const enabled =
      score > 0 ||
      (flag.key.includes('student') && /learn|module|assessment|pretest|posttest/i.test(input.prompt));
    return {
      key: flag.key,
      label: flag.label,
      enabled,
      reason: enabled
        ? `Matched prompt language to ${flag.label}.`
        : 'No strong prompt match; defaulting OFF.',
      matchedModules: enabled ? digest.slice(0, 2).map((m) => m.moduleId) : [],
      matchedTopics: enabled ? promptTokens.slice(0, 6) : [],
    };
  });

  const requiredLearning = digest
    .map((mod) => {
      const hay = [
        mod.title,
        mod.intro,
        ...mod.sections.map((s) => `${s.heading} ${s.body} ${s.topics.join(' ')}`),
        mod.questionTopics.join(' '),
      ].join(' ');
      const score = scoreOverlap(prompt, extractTokens(hay));
      if (score === 0) return null;
      return {
        moduleId: mod.moduleId,
        title: mod.title,
        category: mod.category,
        sections: mod.sections.slice(0, 4).map((s) => s.heading),
        topics: mod.sections.flatMap((s) => s.topics).slice(0, 8),
        reason: `Prompt overlaps with ${mod.title}.`,
      };
    })
    .filter((v): v is FeatureReleaseLearningScope => Boolean(v))
    .slice(0, 12);

  return {
    schemaVersion: 'feature-release-plan-v1',
    source: 'heuristic',
    summary: 'AI provider unavailable; using a prompt-to-module heuristic.',
    toggles,
    requiredLearning,
  };
}

async function callAnthropic(apiKey: string, model: string, payload: unknown): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
      signal: ctrl.signal,
    });
    if (!response.ok) throw new Error(await response.text().catch(() => ''));
    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey: string, model: string, payload: unknown): Promise<string> {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          maxOutputTokens: DEFAULT_MAX_TOKENS,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
      signal: ctrl.signal,
    });
    if (!response.ok) throw new Error(await response.text().catch(() => ''));
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  } finally {
    clearTimeout(timer);
  }
}

function normalizePlan(raw: ParsedPlan, input: PlannerInput, digest: LearningModulePlannerEntry[]): FeatureReleasePlan {
  const toggleMap = new Map((raw.toggles || []).map((t) => [String(t.key || ''), t]));
  const toggles = input.flags.map((flag) => {
    const current = toggleMap.get(flag.key);
    const enabled = current?.enabled === true;
    return {
      key: flag.key,
      label: flag.label,
      enabled,
      reason: typeof current?.reason === 'string' && current.reason.trim()
        ? current.reason
        : (enabled ? 'AI selected this toggle.' : 'AI left this toggle off.'),
      matchedModules: Array.isArray(current?.matchedModules) ? current!.matchedModules!.filter((v): v is string => typeof v === 'string') : [],
      matchedTopics: Array.isArray(current?.matchedTopics) ? current!.matchedTopics!.filter((v): v is string => typeof v === 'string') : [],
    };
  });

  const digestById = new Map(digest.map((m) => [m.moduleId, m]));
  const requiredLearning = (raw.requiredLearning || [])
    .map((entry) => {
      const moduleId = typeof entry.moduleId === 'string' ? entry.moduleId : '';
      const mod = digestById.get(moduleId);
      if (!mod) return null;
      const sections = Array.isArray(entry.sections) ? entry.sections.filter((v): v is string => typeof v === 'string') : mod.sections.map((s) => s.heading);
      const topics = Array.isArray(entry.topics) ? entry.topics.filter((v): v is string => typeof v === 'string') : mod.sections.flatMap((s) => s.topics);
      return {
        moduleId,
        title: typeof entry.title === 'string' ? entry.title : mod.title,
        category: typeof entry.category === 'string' ? entry.category : mod.category,
        sections,
        topics,
        reason: typeof entry.reason === 'string' && entry.reason.trim()
          ? entry.reason
          : `Required by the project prompt.`,
      };
    })
    .filter((v): v is FeatureReleaseLearningScope => Boolean(v));

  return {
    schemaVersion: 'feature-release-plan-v1',
    source: 'ai',
    summary: typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'AI plan generated successfully.',
    toggles,
    requiredLearning,
  };
}

export async function generateFeatureReleasePlan(input: PlannerInput): Promise<FeatureReleasePlan> {
  const digest = buildPlannerDigest();
  const provider = pickProvider();
  const payload = {
    prompt: input.prompt.trim(),
    featureFlags: input.flags,
    learningModules: digest,
  };

  if (!provider) return heuristicPlan(input, digest);

  try {
    const raw = provider.provider === 'gemini'
      ? await callGemini(provider.apiKey, provider.model, payload)
      : await callAnthropic(provider.apiKey, provider.model, payload);
    const parsed = safeJsonParse(raw);
    if (!parsed) return heuristicPlan(input, digest);
    return normalizePlan(parsed, input, digest);
  } catch {
    return heuristicPlan(input, digest);
  }
}
