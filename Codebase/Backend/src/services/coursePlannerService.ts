import { pickProvider } from './aiDocumentationService';
import { buildPlannerDigest, type LearningModulePlannerEntry } from './learningModuleCatalog';

export interface CoursePlanModuleDecision {
  moduleId: string;
  title: string;
  category: string;
  published: boolean;
  reason: string;
  matchedSections: string[];
  matchedTopics: string[];
}

export interface CoursePlanScope {
  moduleId: string;
  title: string;
  category: string;
  sections: string[];
  topics: string[];
  reason: string;
}

export interface CoursePlan {
  schemaVersion: 'course-plan-v1';
  source: 'ai' | 'heuristic';
  summary: string;
  modules: CoursePlanModuleDecision[];
  requiredLearning: CoursePlanScope[];
}

interface PlannerInput {
  prompt: string;
}

const DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = [
  'You are an admin-side course planning assistant.',
  'You receive a project brief and a JSON catalog of learning modules.',
  'Your job is to decide which courses should be published ON or OFF by default,',
  'and which modules, sections, and topics are required for the project.',
  '',
  'Rules:',
  '- Return one JSON object only. No prose, no markdown, no code fences.',
  '- Use the provided modules exactly; every module must appear in modules.',
  '- Default all modules to published=false unless the prompt strongly requires them.',
  '- Prefer a narrow scope. Do not publish unrelated modules.',
  '- Decide required learning by matching the prompt against module titles, sections, and topics.',
  '- Keep strings concise. Keep reason fields short.',
  '- Keep matchedSections and matchedTopics small. Prefer at most 3 sections and at most 8 topics per module.',
  '',
  'Return this schema exactly:',
  '{',
  '  "summary": "string",',
  '  "modules": [',
  '    {',
  '      "moduleId": "string",',
  '      "title": "string",',
  '      "category": "string",',
  '      "published": true,',
  '      "reason": "string",',
  '      "matchedSections": ["string"],',
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
  modules?: Array<Partial<CoursePlanModuleDecision> & { moduleId?: string }>;
  requiredLearning?: Array<Partial<CoursePlanScope> & { moduleId?: string }>;
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

function heuristicPlan(input: PlannerInput, digest: LearningModulePlannerEntry[]): CoursePlan {
  const modules = digest.map((mod) => {
    const hay = [
      mod.title,
      mod.intro,
      ...mod.sections.map((s) => `${s.heading} ${s.body} ${s.topics.join(' ')}`),
      mod.questionTopics.join(' '),
    ].join(' ');
    const score = scoreOverlap(input.prompt, extractTokens(hay));
    const published = score > 0;
    return {
      moduleId: mod.moduleId,
      title: mod.title,
      category: mod.category,
      published,
      reason: published
        ? `Matched prompt language to ${mod.title}.`
        : 'No strong prompt match; defaulting OFF.',
      matchedSections: published ? mod.sections.slice(0, 3).map((s) => s.heading) : [],
      matchedTopics: published ? [...new Set(mod.sections.flatMap((s) => s.topics).slice(0, 8).concat(mod.questionTopics.slice(0, 4)))] : [],
    };
  });

  const requiredLearning = modules
    .filter((m) => m.published)
    .map((m) => {
      const mod = digest.find((d) => d.moduleId === m.moduleId)!;
      return {
        moduleId: m.moduleId,
        title: m.title,
        category: m.category,
        sections: mod.sections.slice(0, 4).map((s) => s.heading),
        topics: [...new Set(mod.sections.flatMap((s) => s.topics).slice(0, 8))],
        reason: `Prompt overlaps with ${m.title}.`,
      };
    })
    .slice(0, 12);

  return {
    schemaVersion: 'course-plan-v1',
    source: 'heuristic',
    summary: 'AI provider unavailable; using a prompt-to-course heuristic.',
    modules,
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
  const attempts = [0, 750, 1750];
  let lastError = 'unknown';

  for (let i = 0; i < attempts.length; i += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      if (attempts[i] > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempts[i]));
      }
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
      if (!response.ok) {
        lastError = await response.text().catch(() => `${response.status} ${response.statusText}`);
        if (response.status === 429 || response.status === 500 || response.status === 503) continue;
        throw new Error(lastError);
      }
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i < attempts.length - 1) continue;
      throw new Error(lastError);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

function normalizePlan(raw: ParsedPlan, digest: LearningModulePlannerEntry[]): CoursePlan {
  const digestById = new Map(digest.map((m) => [m.moduleId, m]));

  const modules = digest.map((mod) => {
    const entry = (raw.modules || []).find((item) => item.moduleId === mod.moduleId);
    const published = entry?.published === true;
    return {
      moduleId: mod.moduleId,
      title: entry?.title || mod.title,
      category: entry?.category || mod.category,
      published,
      reason: typeof entry?.reason === 'string' && entry.reason.trim()
        ? entry.reason
        : (published ? 'AI selected this course for publishing.' : 'AI left this course off by default.'),
      matchedSections: Array.isArray(entry?.matchedSections) ? entry.matchedSections.filter((v): v is string => typeof v === 'string') : [],
      matchedTopics: Array.isArray(entry?.matchedTopics) ? entry.matchedTopics.filter((v): v is string => typeof v === 'string') : [],
    };
  });

  const requiredLearning = (raw.requiredLearning || [])
    .map((entry) => {
      const moduleId = typeof entry.moduleId === 'string' ? entry.moduleId : '';
      const mod = digestById.get(moduleId);
      if (!mod) return null;
      return {
        moduleId,
        title: typeof entry.title === 'string' ? entry.title : mod.title,
        category: typeof entry.category === 'string' ? entry.category : mod.category,
        sections: Array.isArray(entry.sections) ? entry.sections.filter((v): v is string => typeof v === 'string') : mod.sections.map((s) => s.heading),
        topics: Array.isArray(entry.topics) ? entry.topics.filter((v): v is string => typeof v === 'string') : mod.sections.flatMap((s) => s.topics),
        reason: typeof entry.reason === 'string' && entry.reason.trim()
          ? entry.reason
          : 'Required by the project prompt.',
      };
    })
    .filter((v): v is CoursePlanScope => Boolean(v));

  return {
    schemaVersion: 'course-plan-v1',
    source: 'ai',
    summary: typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'AI plan generated successfully.',
    modules,
    requiredLearning,
  };
}

export async function generateCoursePlan(input: PlannerInput): Promise<CoursePlan> {
  const digest = buildPlannerDigest();
  const provider = pickProvider();
  const payload = {
    prompt: input.prompt.trim(),
    modules: digest,
  };

  if (!provider) return heuristicPlan(input, digest);

  try {
    const raw = provider.provider === 'gemini'
      ? await callGemini(provider.apiKey, provider.model, payload)
      : await callAnthropic(provider.apiKey, provider.model, payload);
    const parsed = safeJsonParse(raw);
    if (!parsed) return heuristicPlan(input, digest);
    return normalizePlan(parsed, digest);
  } catch {
    return heuristicPlan(input, digest);
  }
}
