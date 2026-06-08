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

export interface CoursePlanSectionDecision {
  sectionId: string;
  section: string;
  modules: CoursePlanModuleDecision[];
}

export interface CoursePlanScope {
  moduleId: string;
  title: string;
  category: string;
  sections: string[];
  topics: string[];
  reason: string;
}

export interface CoursePlanDiagnostics {
  aiAttempted: boolean;
  aiSucceeded: boolean;
  catalogModuleCount: number;
  selectedSectionCount: number;
  selectedModuleCount: number;
  emptyPlan: boolean;
  message: string;
  fallbackReason?: 'no_provider' | 'invalid_json' | 'ai_error' | 'ai_empty' | 'empty_catalog';
  aiError?: string;
}

export interface CoursePlan {
  schemaVersion: 'course-plan-v1';
  source: 'ai' | 'heuristic';
  summary: string;
  sections: CoursePlanSectionDecision[];
  modules: CoursePlanModuleDecision[];
  requiredLearning: CoursePlanScope[];
  diagnostics: CoursePlanDiagnostics;
}

interface PlannerInput {
  prompt: string;
}

const DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SECTION_ORDER = ['foundations', 'creational', 'structural', 'behavioural', 'idioms'] as const;
const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  foundations: 'Foundations',
  creational: 'Creational',
  structural: 'Structural',
  behavioural: 'Behavioural',
  idioms: 'Idioms',
};

function normalizeSectionId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function sectionLabelFromId(sectionId: string): string {
  const normalized = normalizeSectionId(sectionId);
  const known = SECTION_LABELS[normalized as keyof typeof SECTION_LABELS];
  if (known) return known;
  return normalized.replace(/(^|-)\w/g, (match) => match.replace('-', '').toUpperCase());
}

function sectionSortIndex(sectionId: string): number {
  const normalized = normalizeSectionId(sectionId);
  const idx = SECTION_ORDER.indexOf(normalized as (typeof SECTION_ORDER)[number]);
  return idx === -1 ? SECTION_ORDER.length : idx;
}

function uniqueStrings(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

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
    signals: ['wrong interface', 'translation', 'convert', 'map payload', 'partner api', 'old api', 'wrap legacy', 'request shape', 'compatibility layer'],
  },
  {
    slug: 'proxy',
    name: 'Proxy',
    family: 'Structural',
    intent: 'Stand in for an object and control access to it.',
    whenToUse: 'The real object is expensive, remote, lazy, cached, or needs access control.',
    avoidWhen: 'The wrapper only adds behavior and does not gate or defer access.',
    signals: ['lazy load', 'cache', 'access control', 'gate', 'remote object', 'slow service', 'defer call'],
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
    signals: ['subscribe', 'notify', 'listeners', 'events', 'pub sub', 'live update', 'status changes'],
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
    signals: ['simple entry point', 'subsystem wrapper', 'hide complexity', 'one-stop api', 'dashboard entry point'],
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
  'then decide which learning sections and modules should be ON for the project.',
  '',
  'Rules:',
  '- Return one JSON object only. No prose, no markdown, no code fences.',
  '- Use the provided modules exactly.',
  '- Treat each module category as a section.',
  '- Return only sections that should be ON.',
  '- Sections that are missing from the JSON are OFF.',
  '- Sections that appear but contain no modules are dropped during parsing.',
  '- Inside each section, list only the modules that should be ON.',
  '- Do not include OFF modules inside a selected section.',
  '- Prefer a narrow scope. Do not select unrelated sections.',
  '- Minimize the number of sections and modules included.',
  '- Minimize does not mean return nothing when the brief has a clear architecture problem.',
  '- If the brief clearly maps to one design pattern, include that one pattern module.',
  '- Return an empty sections array only when no provided module matches the project at all.',
  '- If multiple patterns can solve the same need, choose only the single best fit.',
  '- Do not show extra fallback patterns just because they are related.',
  '- Prefer the most specific pattern over a broad one.',
  '- If a module or section is optional, keep it OFF.',
  '- When two or more patterns are plausible, pick the one with the clearest direct match and exclude the rest.',
  '- First infer the needed design patterns from the project brief using the catalog below.',
  '- Then map those patterns to the minimum module set in the provided module catalog.',
  '- Only keep foundational modules when they are direct prerequisites for a selected pattern.',
  '- Foundations are the baseline learning block: keep them ON whenever the project needs any course plan at all.',
  '- Minimize the pattern modules first; do not minimize away the baseline foundations.',
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
  '  "sections": [',
  '    {',
  '      "sectionId": "string",',
  '      "section": "string",',
  '      "modules": [',
  '        {',
  '          "moduleId": "string",',
  '          "title": "string",',
  '          "category": "string",',
  '          "published": true,',
  '          "reason": "string",',
  '          "matchedSections": ["string"],',
  '          "matchedTopics": ["string"]',
  '        }',
  '      ]',
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

interface ParsedPlanModule {
  moduleId?: string;
  title?: string;
  category?: string;
  published?: boolean;
  reason?: string;
  matchedSections?: string[];
  matchedTopics?: string[];
}

interface ParsedPlanSection {
  sectionId?: string;
  section?: string;
  modules?: ParsedPlanModule[];
}

interface ParsedPlan {
  summary?: string;
  sections?: ParsedPlanSection[];
  modules?: ParsedPlanModule[];
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

function findPatternForModule(mod: LearningModulePlannerEntry): PatternCatalogEntry | null {
  const moduleKey = normalizeSectionId(`${mod.moduleId} ${mod.title}`);
  return PATTERN_CATALOG.find((pattern) => {
    const slug = normalizeSectionId(pattern.slug);
    const name = normalizeSectionId(pattern.name);
    return moduleKey.includes(slug) || moduleKey.includes(name);
  }) ?? null;
}

function scorePatternMatch(prompt: string, pattern: PatternCatalogEntry): number {
  const promptTokens = extractTokens(prompt);
  const promptText = String(prompt || '').toLowerCase();
  const patternText = [
    pattern.slug,
    pattern.name,
    pattern.intent,
    pattern.whenToUse,
    ...pattern.signals,
  ].join(' ');
  let score = scoreOverlap(prompt, extractTokens(patternText));
  if (promptText.includes(pattern.name.toLowerCase())) score += 8;
  if (promptText.includes(pattern.slug.replace(/-/g, ' '))) score += 8;
  for (const signal of pattern.signals) {
    const signalText = signal.toLowerCase();
    const signalTokens = extractTokens(signal);
    if (signalText && promptText.includes(signalText)) score += 6;
    if (signalTokens.length > 0 && signalTokens.every((token) => promptTokens.includes(token))) {
      score += 2 + signalTokens.length;
    }
  }
  return score;
}

function pickTopics(mod: LearningModulePlannerEntry): string[] {
  return uniqueStrings([
    ...mod.sections.flatMap((s) => s.topics).slice(0, 8),
    ...mod.questionTopics.slice(0, 4),
  ]).slice(0, 8);
}

function pickSections(mod: LearningModulePlannerEntry, limit = 3): string[] {
  return uniqueStrings(mod.sections.slice(0, limit).map((section) => section.heading));
}

function buildModuleDecision(
  mod: LearningModulePlannerEntry,
  published: boolean,
  reason: string,
  matchedSections: string[],
  matchedTopics: string[],
): CoursePlanModuleDecision {
  return {
    moduleId: mod.moduleId,
    title: mod.title,
    category: mod.category,
    published,
    reason,
    matchedSections: uniqueStrings(matchedSections).slice(0, 3),
    matchedTopics: uniqueStrings(matchedTopics).slice(0, 8),
  };
}

function buildNormalizedSections(digest: LearningModulePlannerEntry[], decisions: ReadonlyArray<CoursePlanModuleDecision>): CoursePlanSectionDecision[] {
  const bySection = new Map<string, CoursePlanModuleDecision[]>();
  for (const mod of digest) {
    const decision = decisions.find((entry) => entry.moduleId === mod.moduleId);
    if (!decision?.published) continue;
    const sectionId = normalizeSectionId(mod.category);
    const bucket = bySection.get(sectionId) ?? [];
    bucket.push(decision);
    bySection.set(sectionId, bucket);
  }

  return Array.from(bySection.entries())
    .sort(([a], [b]) => sectionSortIndex(a) - sectionSortIndex(b))
    .map(([sectionId, rows]) => ({
      sectionId,
      section: sectionLabelFromId(sectionId),
      modules: rows,
    }));
}

function buildCoursePlanFromDecisions(
  digest: LearningModulePlannerEntry[],
  decisions: CoursePlanModuleDecision[],
  requiredLearning: CoursePlanScope[],
  summary: string,
  source: 'ai' | 'heuristic',
  diagnostics: Partial<CoursePlanDiagnostics> = {},
): CoursePlan {
  const sections = buildNormalizedSections(digest, decisions);
  const selectedModuleCount = decisions.filter((decision) => decision.published).length;
  const computedDiagnostics = {
    catalogModuleCount: digest.length,
    selectedSectionCount: sections.length,
    selectedModuleCount,
    emptyPlan: selectedModuleCount === 0,
  };
  return {
    schemaVersion: 'course-plan-v1',
    source,
    summary,
    sections,
    modules: decisions,
    requiredLearning,
    diagnostics: {
      aiAttempted: source === 'ai',
      aiSucceeded: source === 'ai',
      ...computedDiagnostics,
      message: selectedModuleCount === 0
        ? 'No modules were selected.'
        : `${selectedModuleCount} module${selectedModuleCount === 1 ? '' : 's'} selected.`,
      ...diagnostics,
      ...computedDiagnostics,
    },
  };
}

function heuristicPlan(
  input: PlannerInput,
  digest: LearningModulePlannerEntry[],
  diagnostics: Partial<CoursePlanDiagnostics> = {},
): CoursePlan {
  const fallbackSummary = diagnostics.message ?? 'Using local prompt-to-course heuristic.';
  const scored = digest.map((mod) => {
    const pattern = findPatternForModule(mod);
    const hay = [
      mod.title,
      mod.intro,
      ...mod.sections.map((s) => `${s.heading} ${s.body} ${s.topics.join(' ')}`),
      mod.questionTopics.join(' '),
    ].join(' ');
    const moduleScore = scoreOverlap(input.prompt, extractTokens(hay));
    const patternScore = pattern ? scorePatternMatch(input.prompt, pattern) : 0;
    return {
      mod,
      pattern,
      moduleScore,
      patternScore,
      score: moduleScore + (patternScore * 3),
    };
  });

  const rankedPatternMatches = scored
    .filter((item) => item.patternScore >= 2)
    .sort((a, b) => b.score - a.score);
  const rankedModuleMatches = scored
    .filter((item) => item.moduleScore >= 2)
    .sort((a, b) => b.score - a.score);
  const ranked = rankedPatternMatches.length > 0 ? rankedPatternMatches : rankedModuleMatches;
  const bestScore = ranked[0]?.score ?? 0;
  const selectedIds = new Set(
    ranked
      .filter((item) => item.score >= Math.max(2, bestScore * 0.7))
      .slice(0, 4)
      .map((item) => item.mod.moduleId),
  );
  if (selectedIds.size > 0) {
    for (const mod of digest) {
      if (mod.isFoundationBaseline) selectedIds.add(mod.moduleId);
    }
  }

  const decisions = scored.map(({ mod, pattern }) => {
    const published = selectedIds.has(mod.moduleId);
    return buildModuleDecision(
      mod,
      published,
      published
        ? (mod.isFoundationBaseline
            ? 'Foundations stay ON as the baseline learning block.'
            : `Matched ${pattern?.name ?? mod.title} to the project brief.`)
        : 'No strong prompt match; defaulting OFF.',
      published ? pickSections(mod) : [],
      published ? pickTopics(mod) : [],
    );
  });

  const requiredLearning = decisions
    .filter((m) => m.published)
    .map((m) => {
      const mod = digest.find((d) => d.moduleId === m.moduleId)!;
      return {
        moduleId: m.moduleId,
        title: m.title,
        category: m.category,
        sections: mod.sections.slice(0, 4).map((s) => s.heading),
        topics: pickTopics(mod),
        reason: `Prompt overlaps with ${m.title}.`,
      };
    })
    .slice(0, 12);

  return buildCoursePlanFromDecisions(
    digest,
    decisions,
    requiredLearning,
    fallbackSummary,
    'heuristic',
    {
      aiAttempted: false,
      aiSucceeded: false,
      message: 'Using local heuristic fallback.',
      ...diagnostics,
    },
  );
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
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sectionMode = rawSections.length > 0;
  const moduleEntries = new Map<string, ParsedPlanModule>();
  const moduleSectionLabels = new Map<string, string>();
  const hasAnySelectedModule = sectionMode
    ? rawSections.some((rawSection) => Array.isArray(rawSection.modules) && rawSection.modules.length > 0)
    : (Array.isArray(raw.modules) && raw.modules.length > 0);

  if (sectionMode) {
    for (const rawSection of rawSections) {
      const sectionId = normalizeSectionId(
        typeof rawSection.sectionId === 'string' && rawSection.sectionId.trim().length > 0
          ? rawSection.sectionId
          : rawSection.section || '',
      );
      if (!sectionId) continue;
      const sectionLabel = typeof rawSection.section === 'string' && rawSection.section.trim().length > 0
        ? rawSection.section.trim()
        : sectionLabelFromId(sectionId);
      const sectionDigest = digest.filter((mod) => normalizeSectionId(mod.category) === sectionId);
      if (sectionDigest.length === 0) continue;
      for (const rawModule of rawSection.modules ?? []) {
        const moduleId = typeof rawModule.moduleId === 'string' ? rawModule.moduleId.trim() : '';
        if (!moduleId || !digestById.has(moduleId)) continue;
        moduleEntries.set(moduleId, rawModule);
        moduleSectionLabels.set(moduleId, sectionLabel);
      }
    }
  } else {
    for (const rawModule of raw.modules || []) {
      const moduleId = typeof rawModule.moduleId === 'string' ? rawModule.moduleId.trim() : '';
      if (!moduleId || !digestById.has(moduleId)) continue;
      moduleEntries.set(moduleId, rawModule);
    }
  }

  const modules = digest.map((mod) => {
    const entry = moduleEntries.get(mod.moduleId);
    const published = mod.isFoundationBaseline
      ? hasAnySelectedModule || entry?.published === true
      : sectionMode ? moduleEntries.has(mod.moduleId) : entry?.published === true;
    const matchedSections = published
      ? (mod.isFoundationBaseline
          ? pickSections(mod)
          : (
              sectionMode
                ? (moduleSectionLabels.get(mod.moduleId) ? [moduleSectionLabels.get(mod.moduleId)!] : pickSections(mod))
                : uniqueStrings(Array.isArray(entry?.matchedSections) ? entry.matchedSections.filter((v): v is string => typeof v === 'string') : pickSections(mod))
            ))
      : [];
    const matchedTopics = published
      ? (mod.isFoundationBaseline
          ? pickTopics(mod)
          : (
              sectionMode
                ? pickTopics(mod)
                : uniqueStrings(Array.isArray(entry?.matchedTopics) ? entry.matchedTopics.filter((v): v is string => typeof v === 'string') : pickTopics(mod))
            ))
      : [];
    return buildModuleDecision(
      mod,
      published,
      mod.isFoundationBaseline
        ? 'Foundations stay ON as the baseline learning block.'
        : typeof entry?.reason === 'string' && entry.reason.trim()
        ? entry.reason
        : (published ? 'AI selected this course for publishing.' : 'AI left this course off by default.'),
      matchedSections,
      matchedTopics,
    );
  });
  const sections = buildNormalizedSections(digest, modules);

  const requiredLearning = modules
    .filter((m) => m.published)
    .map((m) => {
      const mod = digestById.get(m.moduleId);
      if (!mod) return null;
      return {
        moduleId: m.moduleId,
        title: m.title,
        category: m.category,
        sections: pickSections(mod, 4),
        topics: pickTopics(mod),
        reason: typeof moduleEntries.get(m.moduleId)?.reason === 'string' && moduleEntries.get(m.moduleId)!.reason!.trim()
          ? moduleEntries.get(m.moduleId)!.reason!.trim()
          : 'Required by the project prompt.',
      };
    })
    .filter((value): value is CoursePlanScope => Boolean(value))
    .slice(0, 12);

  return buildCoursePlanFromDecisions(
    digest,
    modules,
    requiredLearning,
    typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'AI plan generated successfully.',
    'ai',
    {
      aiAttempted: true,
      aiSucceeded: true,
      message: 'AI returned a valid JSON course plan.',
    },
  );
}

export async function generateCoursePlan(input: PlannerInput): Promise<CoursePlan> {
  const digest = buildPlannerDigest({ includeUnpublished: true });
  const provider = pickProvider();
  const payload = {
    prompt: input.prompt.trim(),
    modules: digest,
  };

  if (digest.length === 0) {
    return heuristicPlan(input, digest, {
      fallbackReason: 'empty_catalog',
      message: 'No learning modules exist in the catalog.',
    });
  }

  if (!provider) {
    return heuristicPlan(input, digest, {
      fallbackReason: 'no_provider',
      message: 'AI provider is not configured; using local heuristic fallback.',
    });
  }

  try {
    const raw = provider.provider === 'gemini'
      ? await callGemini(provider.apiKey, provider.model, payload)
      : await callAnthropic(provider.apiKey, provider.model, payload);
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      return heuristicPlan(input, digest, {
        aiAttempted: true,
        aiSucceeded: false,
        fallbackReason: 'invalid_json',
        message: 'AI returned invalid JSON; using local heuristic fallback.',
      });
    }
    const plan = normalizePlan(parsed, digest);
    if (plan.diagnostics.emptyPlan) {
      return heuristicPlan(input, digest, {
        aiAttempted: true,
        aiSucceeded: true,
        fallbackReason: 'ai_empty',
        message: 'AI returned valid JSON but selected no modules; using local heuristic fallback.',
      });
    }
    return plan;
  } catch (err) {
    return heuristicPlan(input, digest, {
      aiAttempted: true,
      aiSucceeded: false,
      fallbackReason: 'ai_error',
      aiError: err instanceof Error ? err.message : String(err),
      message: 'AI request failed; using local heuristic fallback.',
    });
  }
}
