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
  patternAudit?: PatternAuditEntry[];
}

export interface PatternAuditEntry {
  slug: string;
  name: string;
  family: PatternCatalogEntry['family'];
  score: number;
  selected: boolean;
  matchedEvidence: string[];
  rejectedReason?: string;
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
export const BUSINESS_PATTERN_SELECTION_LIMIT = 5;

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

function normalizePromptText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectPhraseHits(promptText: string, promptTokens: string[], phrases: ReadonlyArray<string>, weight: number, prefix: string): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];
  for (const phrase of uniqueStrings(phrases)) {
    const normalizedPhrase = normalizePromptText(phrase);
    if (!normalizedPhrase) continue;
    const phraseTokens = extractTokens(phrase);
    const exactMatch = promptText.includes(normalizedPhrase);
    const tokenMatch = phraseTokens.length >= 2 && phraseTokens.every((token) => promptTokens.includes(token));
    if (exactMatch || tokenMatch) {
      score += weight;
      evidence.push(`${prefix}:${phrase}`);
    }
  }
  return { score, evidence };
}

function collectPatternEvidence(prompt: string, pattern: PatternCatalogEntry): { score: number; matchedEvidence: string[] } {
  const promptText = normalizePromptText(prompt);
  const promptTokens = extractTokens(prompt);
  const guide = PATTERN_CONTEXT_GUIDE[pattern.slug];

  let score = 0;
  const matchedEvidence: string[] = [];

  const slugHit = promptText.includes(normalizePromptText(pattern.slug.replace(/-/g, ' ')));
  const nameHit = promptText.includes(normalizePromptText(pattern.name));
  if (slugHit) {
    score += 10;
    matchedEvidence.push(`name:${pattern.slug}`);
  }
  if (nameHit && pattern.name.toLowerCase() !== pattern.slug.replace(/-/g, ' ')) {
    score += 10;
    matchedEvidence.push(`title:${pattern.name}`);
  }

  const signalHits = collectPhraseHits(promptText, promptTokens, pattern.signals, 7, 'signal');
  score += signalHits.score;
  matchedEvidence.push(...signalHits.evidence);

  const businessCueHits = collectPhraseHits(promptText, promptTokens, PATTERN_BUSINESS_CUES[pattern.slug] ?? [], 6, 'cue');
  score += businessCueHits.score;
  matchedEvidence.push(...businessCueHits.evidence);

  if (guide) {
    const neededWhenHits = collectPhraseHits(promptText, promptTokens, guide.neededWhen, 4, 'useWhen');
    const subScenarioHits = collectPhraseHits(promptText, promptTokens, guide.subScenarios, 4, 'scenario');
    const neededConceptHits = collectPhraseHits(promptText, promptTokens, guide.neededConcepts, 2, 'concept');
    const selectionTestHits = collectPhraseHits(promptText, promptTokens, guide.selectionTest ? [guide.selectionTest] : [], 3, 'test');
    const distinguishHits = collectPhraseHits(promptText, promptTokens, guide.distinguishFrom, 1, 'contrast');
    const mainConceptHits = collectPhraseHits(promptText, promptTokens, guide.mainConcept ? [guide.mainConcept] : [], 1, 'concept');

    score += neededWhenHits.score;
    score += subScenarioHits.score;
    score += neededConceptHits.score;
    score += selectionTestHits.score;
    score += distinguishHits.score;
    score += mainConceptHits.score;

    matchedEvidence.push(
      ...neededWhenHits.evidence,
      ...subScenarioHits.evidence,
      ...neededConceptHits.evidence,
      ...selectionTestHits.evidence,
      ...distinguishHits.evidence,
      ...mainConceptHits.evidence,
    );
  }

  return {
    score,
    matchedEvidence: uniqueStrings(matchedEvidence),
  };
}

export interface PatternCatalogEntry {
  slug: string;
  name: string;
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  intent: string;
  whenToUse: string;
  avoidWhen: string;
  signals: string[];
}

export interface PatternContextGuide {
  mainConcept: string;
  neededConcepts: string[];
  neededWhen: string[];
  notNeededWhen: string[];
  subScenarios: string[];
  distinguishFrom: string[];
  selectionTest: string;
}

export const PATTERN_CATALOG: PatternCatalogEntry[] = [
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

const PATTERN_BUSINESS_CUES: Record<string, string[]> = {
  adapter: ['compatibility layer', 'interface translation', 'partner integrations', 'different request formats', 'normalized'],
  facade: ['single front door', 'one consistent process', 'several backend services', 'subsystem boundary'],
  strategy: ['decision rules', 'pricing rules', 'prioritization rules', 'policy variation'],
  observer: ['live updates', 'live status updates', 'status notifications', 'event fan-out'],
  command: ['queued actions', 'queued for audit', 'audit trail', 'possible retry', 'retryable work'],
  proxy: ['access control', 'lazy access', 'remote boundary'],
  decorator: ['optional behavior layers', 'stacked enrichment', 'non-breaking extension'],
  composite: ['tree structure', 'whole-part model', 'uniform operations'],
  singleton: ['single owner', 'shared instance', 'unique resource'],
  builder: ['staged setup', 'optional configuration', 'final product'],
  'factory-method': ['chosen creation', 'caller hides concrete choice', 'product selection'],
  'abstract-factory': ['compatible family', 'product set', 'provider family'],
  'method-chaining': ['fluent setup', 'same object return', 'configuration chain'],
  'template-method': ['fixed algorithm order', 'shared workflow skeleton', 'approval pipeline', 'review pipeline', 'subclass steps', 'hook methods'],
  bridge: ['independent variation', 'two changing dimensions', 'separate layers'],
  'chain-of-responsibility': ['handler pipeline', 'progressive checks', 'fallthrough routing'],
  mediator: ['central coordinator', 'reduced chatter', 'orchestrated workflow'],
  visitor: ['new operations', 'stable structure', 'external inspection'],
  interpreter: ['grammar-driven rules', 'mini language', 'expression evaluation'],
  memento: ['snapshot restore', 'undo checkpoints', 'history safety'],
  state: ['mode-based behavior', 'lifecycle transitions', 'state-driven rules'],
  iterator: ['controlled traversal', 'collection walk', 'hidden storage'],
  repository: ['storage boundary', 'domain persistence', 'data hiding'],
  pimpl: ['implementation hiding', 'stable headers', 'compile-time isolation'],
  prototype: ['clone existing config', 'copy a template', 'cheap duplication'],
  flyweight: ['shared intrinsic data', 'memory reuse', 'many small objects'],
};

export const PATTERN_CONTEXT_GUIDE: Record<string, PatternContextGuide> = {
  singleton: {
    mainConcept: 'Keep exactly one authoritative instance alive for a resource whose duplication would break correctness or coordination.',
    neededConcepts: ['single ownership', 'controlled construction', 'shared lifetime', 'global access boundary', 'test/reset strategy'],
    neededWhen: [
      'one process-wide configuration, license, logger, scheduler, hardware gateway, or shared resource registry must stay unique',
      'different callers need the same authoritative object and duplicate instances would create conflicting state',
      'the project brief says there must be one shared coordinator and the lifetime is application-wide',
    ],
    notNeededWhen: [
      'the request only wants convenient access to a normal dependency',
      'there can be one instance per tenant, user, request, tab, or test case',
      'dependency injection or explicit ownership would keep the design clearer',
    ],
    subScenarios: [
      'one audit logger writes ordered events for the whole process',
      'one feature-flag registry reloads configuration for all services',
      'one hardware controller owns a physical device connection',
    ],
    distinguishFrom: ['Factory Method creates objects but does not require uniqueness', 'Proxy controls access but may wrap many real objects', 'Service locator/global variable is not enough reason by itself'],
    selectionTest: 'Would two live instances create incorrect behavior, conflicting state, or duplicated ownership? If not, do not choose Singleton.',
  },
  'factory-method': {
    mainConcept: 'Move product creation behind a polymorphic creation method so callers depend on an interface rather than a concrete class.',
    neededConcepts: ['product interface', 'creator boundary', 'subclass or override decides concrete type', 'late binding of creation'],
    neededWhen: [
      'the project chooses a concrete exporter, parser, gateway, report generator, or connector based on platform, input type, or deployment',
      'callers must create products without naming concrete classes',
      'new product variants should be added without editing the caller flow',
    ],
    notNeededWhen: [
      'only one concrete product exists and is unlikely to vary',
      'the problem is about a family of compatible products, which points to Abstract Factory',
      'the object has many optional construction steps, which points to Builder',
    ],
    subScenarios: [
      'create CSV, PDF, or DOCX exporters from a common exporter interface',
      'choose a payment gateway adapter for region-specific deployments',
      'let each document workflow create its own validator implementation',
    ],
    distinguishFrom: ['Abstract Factory creates related families', 'Builder assembles one complex product step by step', 'Strategy swaps behavior after creation rather than deciding construction'],
    selectionTest: 'Is the main pain that the caller should not know which concrete product to instantiate?',
  },
  builder: {
    mainConcept: 'Assemble one complex object through named steps, then produce a final configured product.',
    neededConcepts: ['staged construction', 'optional parts', 'validation before build', 'readable construction flow', 'final product boundary'],
    neededWhen: [
      'constructors have many optional parameters, conditional fields, or invalid combinations',
      'a report, query, UI layout, request payload, or configuration object is built over several steps',
      'the build process should be readable and validated before use',
    ],
    notNeededWhen: [
      'a small constructor or object literal is clear enough',
      'the fluent API only mutates and returns the same object without producing a final product',
      'the goal is choosing a concrete subtype rather than assembling one object',
    ],
    subScenarios: [
      'build an onboarding workflow with optional notifications, approvals, and audit settings',
      'build a search query with filters, sorting, pagination, and projections',
      'build a document export request with metadata, layout options, and destination settings',
    ],
    distinguishFrom: ['Method Chaining is fluent API style, not necessarily staged product construction', 'Factory Method chooses a product type', 'Prototype clones an existing configured object'],
    selectionTest: 'Is the complexity in assembling one product with many choices or steps?',
  },
  'method-chaining': {
    mainConcept: 'Return the same object from operations so a sequence of configuration or actions reads as one fluent expression.',
    neededConcepts: ['fluent API', 'same-object return', 'ordered calls', 'readability over ceremony'],
    neededWhen: [
      'the project needs an ergonomic configuration surface for filters, rules, validation, or UI setup',
      'calls naturally form a readable sequence and each call modifies the same working object',
      'the API is internal or controlled enough that chained mutability is acceptable',
    ],
    notNeededWhen: [
      'there must be a separate immutable final product, which points to Builder',
      'call order is complex and easy to misuse without validation',
      'the chain hides important side effects or error handling',
    ],
    subScenarios: [
      'configure a validation rule set with require().min().max().message()',
      'compose table filters with where().sort().limit()',
      'set up a test fixture with user().role().withProject()',
    ],
    distinguishFrom: ['Builder usually has a terminal build step', 'Pipeline/Chain of Responsibility passes work across different handlers', 'Fluent style alone is not a GoF structural need'],
    selectionTest: 'Is the main requirement a fluent setup API on the same object rather than object family selection or complex construction?',
  },
  adapter: {
    mainConcept: 'Translate an existing interface or payload into the interface the client expects without changing either side.',
    neededConcepts: ['incompatible interfaces', 'translation layer', 'legacy or vendor boundary', 'method/name/payload mapping'],
    neededWhen: [
      'a partner API, legacy module, external SDK, or old service has the right behavior but the wrong interface',
      'the system must map request/response shapes, naming conventions, protocols, or units',
      'new code needs a stable internal contract while external contracts differ',
    ],
    notNeededWhen: [
      'the wrapper keeps the same interface and adds behavior, which points to Decorator',
      'the wrapper controls access, caching, lazy loading, or remote calls, which points to Proxy',
      'the wrapper only simplifies several subsystem calls, which points to Facade',
    ],
    subScenarios: [
      'convert an old billing SDK into the app payment interface',
      'map a vendor shipping response into an internal shipment DTO',
      'wrap a legacy C++ class whose method names do not match the new service contract',
    ],
    distinguishFrom: ['Facade simplifies a subsystem but does not mainly convert an incompatible interface', 'Decorator preserves interface while adding behavior', 'Bridge separates two dimensions that both vary'],
    selectionTest: 'Is the main pain that one usable thing has the wrong shape for the caller?',
  },
  proxy: {
    mainConcept: 'Place a substitute object in front of a real object to control when and how the real object is accessed.',
    neededConcepts: ['same client-facing contract', 'access gate', 'lazy load', 'cache', 'remote call boundary', 'permission check'],
    neededWhen: [
      'the real object is expensive, remote, protected, slow, cached, or should load only on demand',
      'access needs auditing, authorization, throttling, retry, or lifecycle control',
      'callers should interact with a stand-in without knowing the real object details',
    ],
    notNeededWhen: [
      'the goal is interface conversion, which points to Adapter',
      'the wrapper merely adds optional behavior layers without gating access, which points to Decorator',
      'the code only needs a simpler entry point to many services, which points to Facade',
    ],
    subScenarios: [
      'lazy-load a large document only when its content is requested',
      'cache calls to a remote pricing service behind the same interface',
      'check role permissions before forwarding repository operations',
    ],
    distinguishFrom: ['Decorator adds behavior while preserving direct access intent', 'Adapter changes interface shape', 'Facade exposes a new simpler API'],
    selectionTest: 'Is the wrapper mainly controlling access, lifetime, cost, or remoteness of a real object?',
  },
  decorator: {
    mainConcept: 'Wrap an object with one or more optional behavior layers while keeping the same interface.',
    neededConcepts: ['same interface', 'runtime composition', 'stackable behavior', 'open extension without subclass explosion'],
    neededWhen: [
      'features such as logging, validation, compression, encryption, metrics, or formatting must be combined dynamically',
      'behavior should be added to individual objects without changing the base class',
      'many optional combinations would make inheritance unwieldy',
    ],
    notNeededWhen: [
      'the wrapper changes method names or payload shape, which points to Adapter',
      'the wrapper gates access, lazy loading, or remote communication, which points to Proxy',
      'there is only one simple behavior and no need for runtime stacking',
    ],
    subScenarios: [
      'wrap a notification sender with retry, logging, and metrics decorators',
      'decorate a stream with compression and encryption',
      'decorate a report renderer with watermarking and audit stamps',
    ],
    distinguishFrom: ['Proxy controls access to the real object', 'Adapter changes interface', 'Chain of Responsibility passes a request through handlers that may stop processing'],
    selectionTest: 'Do optional behavior layers need to stack around the same interface at runtime?',
  },
  strategy: {
    mainConcept: 'Put interchangeable algorithms behind a common interface so one can be selected without changing the caller.',
    neededConcepts: ['algorithm family', 'common operation', 'runtime or configuration selection', 'caller decoupled from implementation'],
    neededWhen: [
      'pricing, ranking, routing, validation, export formatting, scoring, or retry policy has multiple algorithms',
      'the algorithm choice depends on project, tenant, user preference, configuration, or environment',
      'new algorithms should be added without rewriting the orchestration flow',
    ],
    notNeededWhen: [
      'behavior changes because the object moves through internal states, which points to State',
      'the flow skeleton is fixed but subclass steps vary, which points to Template Method',
      'there is only one stable algorithm and a small branch is enough',
    ],
    subScenarios: [
      'choose cheapest, fastest, or balanced delivery routing',
      'swap fraud scoring algorithms per merchant tier',
      'select markdown, HTML, or PDF rendering strategy behind one export action',
    ],
    distinguishFrom: ['State changes behavior because of internal state transitions', 'Command represents an action object', 'Factory Method chooses which object to create'],
    selectionTest: 'Is the project asking for interchangeable ways to perform the same operation?',
  },
  observer: {
    mainConcept: 'Let a subject notify many subscribers when state changes without hard-coding those subscribers.',
    neededConcepts: ['subject', 'subscribers/listeners', 'event notification', 'one-to-many dependency', 'decoupled updates'],
    neededWhen: [
      'changes in one object must update dashboards, notifications, logs, caches, or integrations',
      'subscribers can be added or removed without editing the subject',
      'the brief describes events, live status updates, pub/sub, webhooks, or listeners',
    ],
    notNeededWhen: [
      'there is exactly one known receiver and a direct call is clearer',
      'a request must be handled by one handler in a chain, which points to Chain of Responsibility',
      'many peer objects need central coordination, which points to Mediator',
    ],
    subScenarios: [
      'order status updates notify email, analytics, and inventory listeners',
      'project readiness changes update PM dashboard and audit trail',
      'sensor reading changes publish live UI updates',
    ],
    distinguishFrom: ['Mediator centralizes peer communication', 'Chain of Responsibility routes one request through handlers', 'Command stores an action for later execution'],
    selectionTest: 'Does one subject need to fan out state-change notifications to multiple independent listeners?',
  },
  iterator: {
    mainConcept: 'Expose a standard way to traverse a collection without revealing its internal storage shape.',
    neededConcepts: ['collection traversal', 'next/current protocol', 'hidden storage', 'uniform enumeration'],
    neededWhen: [
      'clients must walk trees, pages, database cursors, custom containers, or filtered result sets uniformly',
      'the collection internals may change but traversal code should not',
      'multiple traversal orders or lazy paging are part of the design',
    ],
    notNeededWhen: [
      'a normal array/list loop is enough and storage is already public',
      'the problem is processing a request through handlers, which points to Chain of Responsibility',
      'the project needs object-tree uniform behavior, which points to Composite',
    ],
    subScenarios: [
      'paginate search results without exposing API paging details',
      'walk a tree of folders with depth-first or breadth-first order',
      'iterate over records streamed from a remote data source',
    ],
    distinguishFrom: ['Composite models tree objects uniformly', 'Visitor performs operations over object structures', 'Chain of Responsibility routes requests'],
    selectionTest: 'Is the main need controlled traversal over a collection whose internals should stay hidden?',
  },
  command: {
    mainConcept: 'Represent a request or action as an object so it can be queued, logged, retried, replayed, undone, or scheduled.',
    neededConcepts: ['action object', 'receiver', 'execute method', 'queue/history', 'undo/retry metadata'],
    neededWhen: [
      'user actions, jobs, workflow steps, or service calls must be stored and executed later',
      'the system needs undo/redo, retry, audit logs, queues, macros, or transaction-like batching',
      'senders should not know the receiver implementation',
    ],
    notNeededWhen: [
      'the action is always called immediately with no need to store or replay it',
      'the project needs interchangeable algorithms, which points to Strategy',
      'the project only needs event notification, which points to Observer',
    ],
    subScenarios: [
      'queue export jobs as command objects',
      'store editor operations for undo and redo',
      'retry failed integration calls using serialized commands',
    ],
    distinguishFrom: ['Observer notifies subscribers about events', 'Strategy chooses an algorithm', 'Memento stores state snapshots rather than executable actions'],
    selectionTest: 'Does the action need to become data that can be stored, passed around, delayed, or reversed?',
  },
  composite: {
    mainConcept: 'Model part-whole trees so leaves and groups can be treated through the same interface.',
    neededConcepts: ['tree structure', 'leaf and composite nodes', 'uniform operation', 'recursive composition'],
    neededWhen: [
      'the domain is hierarchical: folders/files, menus/items, org units, UI components, product bundles, permissions, or learning paths',
      'clients should call the same operation on a single item or a group',
      'tree operations need recursion without type-specific caller branches',
    ],
    notNeededWhen: [
      'the structure is flat or only a list of unrelated items',
      'the project only needs traversal of a collection, which points to Iterator',
      'new operations over a stable tree are the real problem, which may point to Visitor',
    ],
    subScenarios: [
      'calculate total cost of product bundles and individual products',
      'render nested menus and single menu items uniformly',
      'evaluate permissions across groups and users with one operation',
    ],
    distinguishFrom: ['Iterator traverses collections', 'Visitor adds operations to stable structures', 'Facade simplifies subsystem access'],
    selectionTest: 'Do individual objects and object groups need the same client-facing operation?',
  },
  'template-method': {
    mainConcept: 'Define a fixed algorithm skeleton in a base class while letting subclasses override selected steps.',
    neededConcepts: ['base algorithm', 'hook methods', 'subclass variation', 'fixed order of steps', 'inversion of control'],
    neededWhen: [
      'several workflows share the same sequence, such as an approval pipeline, onboarding checklist, or review gate, but differ in validation, formatting, authorization, or persistence steps',
      'the order of the workflow must stay consistent across departments, clients, or document types',
      'inheritance is already the accepted extension mechanism',
    ],
    notNeededWhen: [
      'the variant should be swapped dynamically at runtime, which points to Strategy',
      'composition is preferred over inheritance for this extension point',
      'there is no stable shared algorithm skeleton',
    ],
    subScenarios: [
      'document approval pipeline with fixed intake-review-approve-archive order but department-specific checks',
      'customer onboarding flow with common stages and team-specific hook methods',
      'report generation where the header/footer steps vary by report type',
    ],
    distinguishFrom: ['Strategy composes interchangeable algorithms', 'Factory Method varies object creation', 'Chain of Responsibility passes requests across handlers'],
    selectionTest: 'Is there a shared algorithm order or business workflow that must stay fixed while certain steps vary by subclass?',
  },
  state: {
    mainConcept: 'Move state-specific behavior into state objects so an object changes behavior when its internal state changes.',
    neededConcepts: ['state object', 'context object', 'transitions', 'state-specific rules', 'mode-dependent behavior'],
    neededWhen: [
      'an order, ticket, workflow, session, machine, or document behaves differently across lifecycle states',
      'large conditionals check status/mode before every operation',
      'state transitions have rules and side effects that should be explicit',
    ],
    notNeededWhen: [
      'there are only one or two simple branches and they are stable',
      'the behavior choice is an external policy rather than internal lifecycle, which points to Strategy',
      'the project needs event notifications for state changes, which points to Observer',
    ],
    subScenarios: [
      'support ticket behavior changes in open, pending, resolved, and closed states',
      'checkout session changes allowed actions after payment authorization',
      'document approval flow moves through draft, review, approved, and archived modes',
    ],
    distinguishFrom: ['Strategy selects algorithms externally', 'Template Method fixes a workflow skeleton', 'Memento snapshots state for restoration'],
    selectionTest: 'Is behavior primarily determined by the object current lifecycle state and transition rules?',
  },
  repository: {
    mainConcept: 'Hide persistence details behind a collection-like domain interface.',
    neededConcepts: ['domain persistence boundary', 'query abstraction', 'storage independence', 'unit-testable data access'],
    neededWhen: [
      'domain logic should not depend on SQL, HTTP storage calls, ORM details, or cache implementation',
      'the project needs a business-facing search, save, and retrieve boundary over claims, cases, documents, or records',
      'data access must be mocked or swapped across SQLite, Supabase, files, or services',
      'business rules should speak in domain objects and queries rather than database tables',
    ],
    notNeededWhen: [
      'the project is a tiny CRUD screen where the ORM already gives a clean boundary',
      'the issue is translating an external interface, which points to Adapter',
      'the problem is choosing among algorithms rather than persistence access',
    ],
    subScenarios: [
      'fetch learning modules through a course repository while hiding SQLite tables',
      'search, save, and retrieve claims through one domain boundary while storage implementation varies',
      'persist assessment attempts without instructor logic knowing the database schema',
      'swap local storage and remote API in tests behind one repository interface',
    ],
    distinguishFrom: ['Adapter translates incompatible APIs', 'Facade simplifies a subsystem', 'DAO is often lower-level table access while Repository is domain-facing'],
    selectionTest: 'Is the main goal keeping domain/business code independent from storage implementation?',
  },
  pimpl: {
    mainConcept: 'In C++, hide implementation details behind an opaque pointer to reduce header coupling and preserve ABI boundaries.',
    neededConcepts: ['forward declaration', 'opaque Impl type', 'unique_ptr/shared pointer ownership', 'stable public header', 'rebuild isolation'],
    neededWhen: [
      'headers expose private dependencies that cause compile-time coupling or ABI churn',
      'library users should not rebuild when implementation details change',
      'the public class API is stable but internals are large or platform-specific',
    ],
    notNeededWhen: [
      'the class is tiny and compile-time coupling is not a concern',
      'the problem is runtime interface translation, which points to Adapter',
      'the project is not dealing with C++ header or binary compatibility boundaries',
    ],
    subScenarios: [
      'hide platform-specific window implementation from a cross-platform header',
      'reduce rebuilds caused by private third-party includes',
      'ship a stable SDK header while changing internal data structures',
    ],
    distinguishFrom: ['Bridge separates abstraction and implementation as two varying dimensions', 'Adapter changes interface compatibility', 'Facade simplifies subsystem calls'],
    selectionTest: 'Is the problem specifically C++ header dependency, build time, or ABI stability?',
  },
  prototype: {
    mainConcept: 'Create new objects by cloning an existing configured object instead of constructing from scratch.',
    neededConcepts: ['clone operation', 'configured exemplar', 'copy semantics', 'deep/shallow copy rules'],
    neededWhen: [
      'object creation is expensive, complex, or based on a preconfigured template',
      'many similar objects differ only in small fields',
      'runtime-loaded prototypes should create new instances without knowing concrete classes',
    ],
    notNeededWhen: [
      'direct construction is simple and cheap',
      'the issue is choosing a product subtype by input, which points to Factory Method',
      'the issue is step-by-step assembly, which points to Builder',
    ],
    subScenarios: [
      'clone a configured report template and override date range',
      'duplicate game/UI objects with preset defaults',
      'create workflow instances from saved template workflows',
    ],
    distinguishFrom: ['Factory Method creates through a creator method', 'Builder constructs through steps', 'Memento captures state for restoration but is not a factory by itself'],
    selectionTest: 'Is cloning a configured exemplar clearer or cheaper than rebuilding the object from scratch?',
  },
  'abstract-factory': {
    mainConcept: 'Create families of related compatible products without naming their concrete classes.',
    neededConcepts: ['product family', 'compatible variants', 'factory interface', 'environment/theme/provider family'],
    neededWhen: [
      'the system must create several related objects that must belong to the same platform, tenant, theme, provider, or environment',
      'callers should not mix incompatible concrete products',
      'new product families should be introduced with one factory implementation',
    ],
    notNeededWhen: [
      'only one product type is being created, which points to Factory Method',
      'the object has many optional setup steps, which points to Builder',
      'compatibility between products does not matter',
    ],
    subScenarios: [
      'create matching UI button, input, and modal components for each theme',
      'create compatible payment authorization, capture, and refund clients per provider',
      'create cloud-specific storage, queue, and secrets clients for AWS or Azure',
    ],
    distinguishFrom: ['Factory Method creates one product type', 'Builder assembles one product', 'Bridge separates abstraction and implementation dimensions'],
    selectionTest: 'Does the project need a set of related products that must stay compatible as a family?',
  },
  bridge: {
    mainConcept: 'Separate an abstraction from its implementation so both dimensions can vary independently.',
    neededConcepts: ['abstraction hierarchy', 'implementation hierarchy', 'composition link', 'two independent axes of change'],
    neededWhen: [
      'the design has two growing dimensions such as shape/rendering API, report/output channel, device/remote control, or notification/provider',
      'inheritance would create a class explosion from every combination',
      'abstractions and implementations should evolve or be swapped independently',
    ],
    notNeededWhen: [
      'the issue is adapting one incompatible existing interface, which points to Adapter',
      'there is only one dimension of variation',
      'the wrapper mainly controls access or cost, which points to Proxy',
    ],
    subScenarios: [
      'reports vary by report type and output renderer independently',
      'remote controls vary separately from TV/radio device implementations',
      'notifications vary by message type and delivery provider independently',
    ],
    distinguishFrom: ['Adapter retrofits an existing incompatible interface', 'Strategy swaps one algorithm family', 'Abstract Factory creates compatible product families'],
    selectionTest: 'Are there two independent dimensions that would otherwise multiply subclasses?',
  },
  facade: {
    mainConcept: 'Expose a simple, task-oriented entry point over a complex subsystem.',
    neededConcepts: ['subsystem boundary', 'simplified API', 'workflow aggregation', 'client shielding'],
    neededWhen: [
      'clients currently need to call many services/classes in the right order',
      'the project needs a dashboard/service/API that hides subsystem complexity',
      'the subsystem remains available internally but common workflows need a simple front door',
    ],
    notNeededWhen: [
      'the main problem is interface incompatibility with one external type, which points to Adapter',
      'the wrapper adds optional behavior while preserving interface, which points to Decorator',
      'the wrapper controls access to one real object, which points to Proxy',
    ],
    subScenarios: [
      'one checkout service coordinates cart, payment, inventory, and notification services',
      'one course readiness service hides assessments, module progress, and evidence reads',
      'one export facade coordinates template, renderer, storage, and audit subsystems',
    ],
    distinguishFrom: ['Adapter converts interfaces', 'Mediator coordinates peer objects internally', 'Repository hides persistence rather than a broad subsystem workflow'],
    selectionTest: 'Does the project need a simpler entry point over several subsystem operations?',
  },
  flyweight: {
    mainConcept: 'Share immutable intrinsic state across many similar objects while keeping unique extrinsic state outside.',
    neededConcepts: ['intrinsic state', 'extrinsic state', 'object sharing', 'memory pressure', 'factory/cache of shared instances'],
    neededWhen: [
      'there are thousands or millions of similar objects with repeated immutable data',
      'memory usage is important and shared state can be separated cleanly from per-instance state',
      'the same descriptors, glyphs, styles, tiles, permissions, or metadata repeat often',
    ],
    notNeededWhen: [
      'object count is small or memory is not a concern',
      'each object has mostly unique state that cannot be shared',
      'the need is caching expensive remote calls, which points more to Proxy or caching service',
    ],
    subScenarios: [
      'share text glyph metadata while storing per-character position separately',
      'share map tile definitions for many map placements',
      'share immutable role/permission descriptors across many users',
    ],
    distinguishFrom: ['Singleton enforces exactly one instance of a resource', 'Prototype clones configured objects', 'Proxy may cache access but not split intrinsic/extrinsic object state'],
    selectionTest: 'Can repeated immutable state be factored out and shared across many objects to reduce memory?',
  },
  'chain-of-responsibility': {
    mainConcept: 'Pass a request along a sequence of handlers until one handles it or the chain finishes.',
    neededConcepts: ['handler interface', 'next handler', 'request routing', 'optional handling', 'decoupled sender'],
    neededWhen: [
      'more than one component may handle a request and the sender should not choose which one',
      'authorization, validation, escalation, fallback, or classification happens through ordered handlers',
      'handlers may stop processing or pass the request onward',
    ],
    notNeededWhen: [
      'every step must always run as a fixed workflow',
      'one central object coordinates peers, which points to Mediator',
      'the requirement is notification fan-out, which points to Observer',
    ],
    subScenarios: [
      'support ticket escalates from bot to agent to manager',
      'request validation tries tenant rule, project rule, then global fallback',
      'approval request moves through handlers until one has authority',
    ],
    distinguishFrom: ['Observer notifies many listeners', 'Command stores executable requests', 'Template Method fixes an algorithm order inside inheritance'],
    selectionTest: 'Can the sender issue a request without knowing which handler will deal with it?',
  },
  mediator: {
    mainConcept: 'Centralize complex communication between related peer objects so they do not directly depend on each other.',
    neededConcepts: ['central coordinator', 'peer components', 'reduced coupling', 'interaction rules'],
    neededWhen: [
      'many UI widgets, workflow participants, or domain components trigger changes in each other',
      'direct peer-to-peer calls create tangled dependencies',
      'one coordinator can enforce business interaction rules',
    ],
    notNeededWhen: [
      'the problem is one subject notifying many listeners, which points to Observer',
      'a request should pass through a handler chain, which points to Chain of Responsibility',
      'simple direct collaboration between two objects is clear enough',
    ],
    subScenarios: [
      'form fields update validation, submit state, and dependent dropdowns through a form mediator',
      'chat room coordinates messages between users',
      'course planner coordinates prompt, module list, preview, and apply actions',
    ],
    distinguishFrom: ['Observer is event fan-out from a subject', 'Facade is a simple external entry point', 'Controller/service orchestration is only Mediator when it reduces peer coupling'],
    selectionTest: 'Are several peer components communicating too much directly and needing a central coordinator?',
  },
  visitor: {
    mainConcept: 'Add new operations over a stable object structure without changing the object classes.',
    neededConcepts: ['stable element hierarchy', 'visitor interface', 'accept method', 'double dispatch', 'operation extension'],
    neededWhen: [
      'the object structure is stable but new operations such as export, validation, metrics, or rendering keep appearing',
      'operations need type-specific logic across many element classes',
      'changing every element class for each new operation is undesirable',
    ],
    notNeededWhen: [
      'the element class hierarchy changes often',
      'there is only one operation and normal methods are clearer',
      'the issue is traversing a collection, which points to Iterator',
    ],
    subScenarios: [
      'run validation, rendering, and metrics visitors over an AST',
      'export a stable document object model to PDF, HTML, and JSON',
      'calculate costs, constraints, and audit data over stable workflow nodes',
    ],
    distinguishFrom: ['Iterator traverses elements', 'Composite models the tree itself', 'Interpreter evaluates language grammar'],
    selectionTest: 'Is the object structure stable while operations over it change frequently?',
  },
  interpreter: {
    mainConcept: 'Represent grammar rules as objects and evaluate sentences or expressions in a small language.',
    neededConcepts: ['grammar', 'expression tree', 'terminal/nonterminal expressions', 'context', 'evaluation rules'],
    neededWhen: [
      'the project has a small rule language, expression syntax, query DSL, filter grammar, or policy language',
      'grammar rules are stable enough to model as classes',
      'the system needs to parse and evaluate domain-specific expressions repeatedly',
    ],
    notNeededWhen: [
      'the input is simple key-value configuration with no grammar',
      'a full parser generator or existing query engine is more appropriate',
      'the goal is just selecting algorithms, which points to Strategy',
    ],
    subScenarios: [
      'evaluate simple access-control expressions',
      'parse filter syntax like status:open AND priority:high',
      'interpret formula rules for scoring or eligibility',
    ],
    distinguishFrom: ['Strategy chooses among algorithms', 'Visitor may operate over an AST after parsing', 'Chain of Responsibility routes requests'],
    selectionTest: 'Is there a small language or grammar that needs object-modeled evaluation?',
  },
  memento: {
    mainConcept: 'Capture and restore an object internal state without exposing that internal state to outside code.',
    neededConcepts: ['originator', 'memento snapshot', 'caretaker/history', 'encapsulation', 'restore operation'],
    neededWhen: [
      'the system needs undo, rollback, checkpoints, drafts, or restore points',
      'state snapshots must be stored without exposing private fields',
      'a caretaker/history should manage snapshots without understanding internals',
    ],
    notNeededWhen: [
      'the requirement is to log executable actions, which points to Command',
      'normal persistence/audit history is enough and no restore is needed',
      'the object state is already public and trivial to copy safely',
    ],
    subScenarios: [
      'save editor document checkpoints for undo',
      'capture workflow state before risky transitions',
      'restore form builder configuration to a previous version',
    ],
    distinguishFrom: ['Command stores actions and can implement undo through inverse commands', 'Prototype clones objects for creation', 'State models behavior by lifecycle mode'],
    selectionTest: 'Does the project need encapsulated state snapshots that can later restore an object?',
  },
};

export function buildPatternCatalogPrompt(): string {
  return PATTERN_CATALOG.map((pattern) => {
    const guide = PATTERN_CONTEXT_GUIDE[pattern.slug];
    if (!guide) {
      return [
        `${pattern.name} [${pattern.family}] (${pattern.slug})`,
        `intent: ${pattern.intent}`,
        `whenToUse: ${pattern.whenToUse}`,
        `avoidWhen: ${pattern.avoidWhen}`,
        `signals: ${pattern.signals.join(', ')}`,
      ].join(' | ');
    }

    return [
      `${pattern.name} [${pattern.family}] (${pattern.slug})`,
      `intent: ${pattern.intent}`,
      `mainConcept: ${guide.mainConcept}`,
      `neededConcepts: ${guide.neededConcepts.join('; ')}`,
      `useWhen: ${guide.neededWhen.join('; ')}`,
      `doNotUseWhen: ${guide.notNeededWhen.join('; ')}`,
      `subScenarios: ${guide.subScenarios.join('; ')}`,
      `distinguishFrom: ${guide.distinguishFrom.join('; ')}`,
      `selectionTest: ${guide.selectionTest}`,
      `signals: ${pattern.signals.join(', ')}`,
    ].join('\n');
  }).join('\n\n');
}

const SYSTEM_PROMPT = [
  'You are an admin-side course planning assistant.',
  'Assume the model knows little or nothing about design-pattern theory.',
  'Explain and select patterns from business workflows, org structure, and runtime pressure, not from pattern jargon alone.',
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
  '- If the brief clearly shows several different business forces, it is normal to select up to 5 distinct patterns.',
  '- Do not collapse separate concerns into one broad pattern when the brief supports multiple specific ones.',
  '- Return an empty sections array only when no provided module matches the project at all.',
  '- If multiple patterns can solve the same need, choose only the single best fit for that specific need.',
  '- When the prompt has separate needs, select the best pattern for each need up to the 5-pattern limit.',
  '- Do not show extra fallback patterns just because they are related.',
  '- Prefer the most specific pattern over a broad one.',
  '- If a module or section is optional, keep it OFF.',
  '- When two or more patterns are plausible, pick the one with the clearest direct match and exclude the rest.',
  '- First infer the needed design patterns from the project brief using the catalog below.',
  '- Match by structural/business situation, not by pattern name alone.',
  '- For every candidate pattern, check mainConcept, useWhen, doNotUseWhen, subScenarios, distinguishFrom, and selectionTest.',
  '- Select a pattern only when the brief satisfies its selectionTest and at least one concrete useWhen or subScenario.',
  '- Reject a pattern when the brief mainly matches its doNotUseWhen guidance, even if some signal words appear.',
  '- Treat subScenarios as examples for context, not as an exhaustive list.',
  '- Then map those patterns to the minimum module set in the provided module catalog.',
  '- Prefer direct pattern modules and exact matching sections/topics over broad intro material.',
  '- Keep strings concise. Keep reason fields short.',
  '- Keep matchedSections and matchedTopics small. Prefer at most 3 sections and at most 8 topics per module.',
  '- Explain the pattern in business terms when possible: the reason should mention the operational pressure, not the textbook label.',
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

export function findPatternForModule(mod: LearningModulePlannerEntry): PatternCatalogEntry | null {
  const moduleKey = normalizeSectionId(`${mod.moduleId} ${mod.title}`);
  return PATTERN_CATALOG.find((pattern) => {
    const slug = normalizeSectionId(pattern.slug);
    const name = normalizeSectionId(pattern.name);
    return moduleKey.includes(slug) || moduleKey.includes(name);
  }) ?? null;
}

export function scorePatternMatch(prompt: string, pattern: PatternCatalogEntry): number {
  return collectPatternEvidence(prompt, pattern).score;
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

function plannerControlledModules(digest: ReadonlyArray<LearningModulePlannerEntry>): LearningModulePlannerEntry[] {
  return digest.filter((mod) => !mod.isFoundationBaseline);
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
  const scoredCandidates = plannerControlledModules(digest).map((mod) => {
    const pattern = findPatternForModule(mod);
    const hay = [
      mod.title,
      mod.intro,
      ...mod.sections.map((s) => `${s.heading} ${s.body} ${s.topics.join(' ')}`),
      mod.questionTopics.join(' '),
    ].join(' ');
    const moduleScore = scoreOverlap(input.prompt, extractTokens(hay));
    const patternMatch = pattern ? collectPatternEvidence(input.prompt, pattern) : { score: 0, matchedEvidence: [] };
    const patternScore = pattern ? scorePatternMatch(input.prompt, pattern) : 0;
    return {
      mod,
      pattern,
      moduleScore,
      patternScore,
      matchedEvidence: patternMatch.matchedEvidence,
      score: moduleScore + patternScore,
    };
  });

  const ranked = [...scoredCandidates].sort((a, b) => b.score - a.score);
  const bestScore = ranked[0]?.score ?? 0;
  const selectionFloor = bestScore >= 12 ? Math.max(8, Math.round(bestScore * 0.6)) : Number.POSITIVE_INFINITY;
  const selectedIds = new Set(
    ranked
      .filter((item) => item.score >= selectionFloor)
      .filter((item) => item.patternScore >= 8 || item.moduleScore >= 2)
      .slice(0, BUSINESS_PATTERN_SELECTION_LIMIT)
      .map((item) => item.mod.moduleId),
  );
  if (selectedIds.size === 0 && bestScore >= 18 && ranked[0]) {
    selectedIds.add(ranked[0].mod.moduleId);
  }
  for (const mod of digest) {
    if (mod.isFoundationBaseline) selectedIds.add(mod.moduleId);
  }

  const patternByModuleId = new Map(scoredCandidates.map((item) => [item.mod.moduleId, item.pattern]));
  const decisions = digest.map((mod) => {
    const published = selectedIds.has(mod.moduleId);
    const pattern = patternByModuleId.get(mod.moduleId);
    return buildModuleDecision(
      mod,
      published,
      published
        ? (mod.isFoundationBaseline
            ? 'System baseline module; enforced ON outside AI planning.'
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
        reason: mod.isFoundationBaseline
          ? 'System baseline module; enforced ON outside AI planning.'
          : `Prompt overlaps with ${m.title}.`,
      };
    })
    .slice(0, 12);

  const patternAudit = ranked.slice(0, 8).map((item) => ({
    slug: item.pattern?.slug ?? item.mod.moduleId,
    name: item.pattern?.name ?? item.mod.title,
    family: item.pattern?.family ?? 'Idioms',
    score: item.score,
    selected: selectedIds.has(item.mod.moduleId),
    matchedEvidence: uniqueStrings(item.matchedEvidence).slice(0, 6),
    rejectedReason: selectedIds.has(item.mod.moduleId)
      ? undefined
      : item.score < selectionFloor
      ? 'Below the selection floor for this prompt.'
      : item.patternScore < 8 && item.moduleScore < 2
      ? 'Not enough direct business evidence.'
      : 'A stronger pattern ranked ahead of it.',
  })) satisfies PatternAuditEntry[];

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
      patternAudit,
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
        const mod = digestById.get(moduleId);
        if (!moduleId || !mod || mod.isFoundationBaseline) continue;
        moduleEntries.set(moduleId, rawModule);
        moduleSectionLabels.set(moduleId, sectionLabel);
      }
    }
  } else {
    for (const rawModule of raw.modules || []) {
      const moduleId = typeof rawModule.moduleId === 'string' ? rawModule.moduleId.trim() : '';
      const mod = digestById.get(moduleId);
      if (!moduleId || !mod || mod.isFoundationBaseline) continue;
      moduleEntries.set(moduleId, rawModule);
    }
  }

  const modules = digest.map((mod) => {
    const entry = moduleEntries.get(mod.moduleId);
    const published = mod.isFoundationBaseline
      ? true
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
        ? 'System baseline module; enforced ON outside AI planning.'
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
        reason: mod.isFoundationBaseline
          ? 'System baseline module; enforced ON outside AI planning.'
          : typeof moduleEntries.get(m.moduleId)?.reason === 'string' && moduleEntries.get(m.moduleId)!.reason!.trim()
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
  const plannerModules = plannerControlledModules(digest);
  const provider = pickProvider();
  const payload = {
    prompt: input.prompt.trim(),
    modules: plannerModules,
    selectionLimit: BUSINESS_PATTERN_SELECTION_LIMIT,
  };

  if (plannerModules.length === 0) {
    return heuristicPlan(input, digest, {
      fallbackReason: 'empty_catalog',
      message: 'No planner-controllable learning modules exist in the catalog.',
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
