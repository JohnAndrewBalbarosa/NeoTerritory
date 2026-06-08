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

interface PatternCatalogEntry {
  slug: string;
  name: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  intent: string;
  whenToUse: string;
  avoidWhen: string;
  signals: string[];
}

const PATTERN_CATALOG: PatternCatalogEntry[] = [
  {
    slug: 'singleton',
    name: 'Singleton',
    family: 'Creational',
    intent: 'One shared instance with a single access point.',
    whenToUse: 'A resource must stay unique, such as config, logging, or a shared pool.',
    avoidWhen: 'Multiple independent instances are safe or easier to test.',
    signals: ['one instance', 'global access', 'shared state', 'logger', 'config'],
  },
  {
    slug: 'factory-method',
    name: 'Factory Method',
    family: 'Creational',
    intent: 'Let subclasses decide which concrete product to create.',
    whenToUse: 'Creation depends on input, type, or config and callers should not name concretes.',
    avoidWhen: 'The caller already knows the exact concrete type.',
    signals: ['create', 'make', 'instantiate', 'subclass choice', 'product selection'],
  },
  {
    slug: 'builder',
    name: 'Builder',
    family: 'Creational',
    intent: 'Build a complex object step by step.',
    whenToUse: 'Construction has many optional parts or a fluent setup followed by a terminal build.',
    avoidWhen: 'A small constructor is clearer than a staged build flow.',
    signals: ['step by step', 'fluent setup', 'build()', 'optional fields', 'many parameters'],
  },
  {
    slug: 'method-chaining',
    name: 'Method Chaining',
    family: 'Creational',
    intent: 'Return the same object so calls chain fluently.',
    whenToUse: 'An API reads better as a chain of configuration calls.',
    avoidWhen: 'A terminal builder product or a different return type is needed.',
    signals: ['return *this', 'fluent', 'chained calls', 'config api'],
  },
  {
    slug: 'adapter',
    name: 'Adapter',
    family: 'Structural',
    intent: 'Translate one interface into another the caller expects.',
    whenToUse: 'An existing type has the right behavior but the wrong shape or method names.',
    avoidWhen: 'The wrapper keeps the same interface and mainly adds behavior or gates access.',
    signals: ['wrong interface', 'translation', 'wrap legacy', 'compatibility layer'],
  },
  {
    slug: 'proxy',
    name: 'Proxy',
    family: 'Structural',
    intent: 'Stand in for an object and control access to it.',
    whenToUse: 'The real object is expensive, remote, lazy, cached, or needs access control.',
    avoidWhen: 'The wrapper only adds behavior and does not gate or defer access.',
    signals: ['lazy load', 'cache', 'access control', 'gate', 'remote object'],
  },
  {
    slug: 'decorator',
    name: 'Decorator',
    family: 'Structural',
    intent: 'Add behavior to an object without changing its interface.',
    whenToUse: 'Layers of optional behavior should stack at runtime.',
    avoidWhen: 'The wrapper changes the interface or only gates access.',
    signals: ['add behavior', 'wrap same interface', 'layering', 'optional features'],
  },
  {
    slug: 'strategy',
    name: 'Strategy',
    family: 'Behavioural',
    intent: 'Swap algorithms behind a common interface.',
    whenToUse: 'The same operation has multiple interchangeable implementations.',
    avoidWhen: 'The algorithm is fixed and never changes at runtime.',
    signals: ['swap algorithm', 'runtime choice', 'policy', 'interchangeable behavior'],
  },
  {
    slug: 'observer',
    name: 'Observer',
    family: 'Behavioural',
    intent: 'Notify subscribers when state changes.',
    whenToUse: 'One subject must fan out changes to many listeners.',
    avoidWhen: 'The code is a direct one-to-one call path.',
    signals: ['subscribe', 'notify', 'listeners', 'events', 'pub sub'],
  },
  {
    slug: 'iterator',
    name: 'Iterator',
    family: 'Behavioural',
    intent: 'Traverse a collection without exposing its internal structure.',
    whenToUse: 'Iteration should be decoupled from storage shape.',
    avoidWhen: 'A plain range loop already solves the problem.',
    signals: ['traverse', 'next', 'collection walk', 'enumeration'],
  },
  {
    slug: 'command',
    name: 'Command',
    family: 'Behavioural',
    intent: 'Wrap an action as an object.',
    whenToUse: 'The action needs to be queued, stored, replayed, or undone.',
    avoidWhen: 'The action is always called immediately and never stored.',
    signals: ['queue', 'undo', 'replay', 'action object', 'request wrapper'],
  },
  {
    slug: 'composite',
    name: 'Composite',
    family: 'Structural',
    intent: 'Treat individual objects and object trees uniformly.',
    whenToUse: 'The data is tree-shaped and leaves plus branches should share an operation.',
    avoidWhen: 'The structure is flat or not actually hierarchical.',
    signals: ['tree', 'leaf', 'branch', 'uniform treatment', 'hierarchy'],
  },
  {
    slug: 'template-method',
    name: 'Template Method',
    family: 'Behavioural',
    intent: 'Define a fixed algorithm skeleton with overridable steps.',
    whenToUse: 'The overall flow stays the same but some steps vary in subclasses.',
    avoidWhen: 'The steps do not need inheritance-based variation.',
    signals: ['algorithm skeleton', 'override steps', 'hook methods'],
  },
  {
    slug: 'state',
    name: 'State',
    family: 'Behavioural',
    intent: 'Change behavior when internal state changes.',
    whenToUse: 'An object behaves differently depending on its current state.',
    avoidWhen: 'A simple branch or enum switch is enough.',
    signals: ['state-driven behavior', 'transition', 'mode', 'current state'],
  },
  {
    slug: 'repository',
    name: 'Repository',
    family: 'Structural',
    intent: 'Hide persistence behind a collection-like interface.',
    whenToUse: 'Domain code should not know storage details.',
    avoidWhen: 'The code is not about data access or persistence abstraction.',
    signals: ['storage abstraction', 'collection interface', 'persistence', 'data access'],
  },
  {
    slug: 'pimpl',
    name: 'PIMPL',
    family: 'Idioms',
    intent: 'Hide implementation details behind an opaque pointer.',
    whenToUse: 'Headers need stable ABI, smaller rebuilds, or fewer dependencies.',
    avoidWhen: 'The class is tiny and compile-time coupling is not a problem.',
    signals: ['opaque pointer', 'impl hiding', 'compile time', 'header isolation'],
  },
  {
    slug: 'prototype',
    name: 'Prototype',
    family: 'Creational',
    intent: 'Create new objects by cloning an existing one.',
    whenToUse: 'Construction is expensive or based on a configured template object.',
    avoidWhen: 'Direct construction is simpler and cheaper.',
    signals: ['clone', 'copy template', 'duplicate object', 'prototype instance'],
  },
  {
    slug: 'abstract-factory',
    name: 'Abstract Factory',
    family: 'Creational',
    intent: 'Create related families of objects without naming concrete classes.',
    whenToUse: 'You need multiple products that must stay compatible with each other.',
    avoidWhen: 'Only one product type is being created.',
    signals: ['family of products', 'compatible set', 'creation suite', 'abstract creator'],
  },
  {
    slug: 'bridge',
    name: 'Bridge',
    family: 'Structural',
    intent: 'Separate abstraction from implementation so both can vary.',
    whenToUse: 'Two dimensions of change must evolve independently.',
    avoidWhen: 'The abstraction and implementation always change together.',
    signals: ['separate abstraction', 'implementation split', 'two axes', 'independent variation'],
  },
  {
    slug: 'facade',
    name: 'Facade',
    family: 'Structural',
    intent: 'Expose a simple entry point to a complex subsystem.',
    whenToUse: 'A thin wrapper should reduce the number of calls a client must know.',
    avoidWhen: 'The caller already needs the fine-grained subsystem details.',
    signals: ['simple entry point', 'subsystem wrapper', 'hide complexity', 'one-stop api'],
  },
  {
    slug: 'flyweight',
    name: 'Flyweight',
    family: 'Structural',
    intent: 'Share intrinsic state across many tiny objects.',
    whenToUse: 'There are many similar objects and memory reuse matters.',
    avoidWhen: 'Each object carries unique state that cannot be shared.',
    signals: ['shared state', 'many objects', 'memory reuse', 'intrinsic state'],
  },
  {
    slug: 'chain-of-responsibility',
    name: 'Chain of Responsibility',
    family: 'Behavioural',
    intent: 'Pass a request through a chain of handlers until one handles it.',
    whenToUse: 'More than one component may handle the same request and the sender should not pick the handler directly.',
    avoidWhen: 'A single known function always handles the request.',
    signals: ['handler chain', 'pass along', 'request pipeline', 'fallthrough'],
  },
  {
    slug: 'mediator',
    name: 'Mediator',
    family: 'Behavioural',
    intent: 'Centralize communication between related objects.',
    whenToUse: 'Peer objects talk too much to each other and need a coordinator.',
    avoidWhen: 'A direct one-to-one collaboration is simpler and clearer.',
    signals: ['central coordinator', 'peer chatter', 'communication hub', 'orchestrator'],
  },
  {
    slug: 'visitor',
    name: 'Visitor',
    family: 'Behavioural',
    intent: 'Add operations to object structures without changing the classes.',
    whenToUse: 'The object shape is stable but new operations keep appearing.',
    avoidWhen: 'The structure changes frequently or the operation is one-off.',
    signals: ['new operations', 'stable structure', 'external traversal', 'double dispatch'],
  },
  {
    slug: 'interpreter',
    name: 'Interpreter',
    family: 'Behavioural',
    intent: 'Represent and evaluate a small language or grammar.',
    whenToUse: 'The project must parse or interpret a constrained language form.',
    avoidWhen: 'The input is not language-like or grammar-driven.',
    signals: ['grammar', 'parse', 'evaluate expression', 'language rules'],
  },
  {
    slug: 'memento',
    name: 'Memento',
    family: 'Behavioural',
    intent: 'Capture and restore an object state without exposing internals.',
    whenToUse: 'Undo/restore snapshots are needed and encapsulation must stay intact.',
    avoidWhen: 'State recovery is not part of the workflow.',
    signals: ['snapshot', 'undo', 'restore', 'checkpoint', 'rollback'],
  },
];

function buildPatternCatalogPrompt(): string {
  return PATTERN_CATALOG.map((pattern) => [
    `${pattern.name} [${pattern.family}] (${pattern.slug})`,
    `intent: ${pattern.intent}`,
    `whenToUse: ${pattern.whenToUse}`,
    `avoidWhen: ${pattern.avoidWhen}`,
    `signals: ${pattern.signals.join(', ')}`,
  ].join(' | ')).join('\n');
}

const SYSTEM_PROMPT = [
  'You are an admin-side course planning assistant.',
  'You receive a project brief and a JSON catalog of learning modules.',
  'Your job is to infer the minimum required design patterns from the brief,',
  'then decide which courses should be published ON or OFF by default,',
  'and which modules, sections, and topics are required for the project.',
  '',
  'Rules:',
  '- Return one JSON object only. No prose, no markdown, no code fences.',
  '- Use the provided modules exactly; every module must appear in modules.',
  '- Default all modules to published=false unless the prompt strongly requires them.',
  '- Prefer a narrow scope. Do not publish unrelated modules.',
  '- First infer the needed design patterns from the project brief using the catalog below.',
  '- Then map those patterns to the minimum module set in the provided module catalog.',
  '- Only keep foundational modules when they are direct prerequisites for a selected pattern.',
  '- Prefer direct pattern modules and exact matching sections/topics over broad intro material.',
  '- Keep strings concise. Keep reason fields short.',
  '- Keep matchedSections and matchedTopics small. Prefer at most 3 sections and at most 8 topics per module.',
  '',
  'Pattern catalog:',
  buildPatternCatalogPrompt(),
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
