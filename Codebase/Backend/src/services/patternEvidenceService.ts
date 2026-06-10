export interface PatternEvidencePattern {
  slug: string;
  name: string;
  signals: string[];
}

export interface PatternEvidenceGuide {
  mainConcept: string;
  neededConcepts: string[];
  neededWhen: string[];
  notNeededWhen: string[];
  subScenarios: string[];
  distinguishFrom: string[];
  selectionTest: string;
}

export interface PatternEvidenceResult {
  score: number;
  matchedEvidence: string[];
}

export interface PatternTopicGroup {
  topic: string;
  cues: string[];
  moduleIds: string[];
}

export const PATTERN_EVIDENCE_HINTS: Record<string, string[]> = {
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
  'template-method': ['fixed algorithm order', 'approval pipeline', 'review pipeline', 'shared workflow skeleton', 'subclass steps', 'hook methods'],
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

export const TOPIC_GROUPS: PatternTopicGroup[] = [
  {
    topic: 'module boundaries',
    cues: ['module boundary', 'module boundaries', 'subsystem boundary', 'front door', 'workflow coordination'],
    moduleIds: ['foundations-code-structure'],
  },
  {
    topic: 'dependency direction',
    cues: ['dependency direction', 'dependency flow', 'coupling', 'external dependency', 'partner integration'],
    moduleIds: ['foundations-code-structure'],
  },
  {
    topic: 'interface design',
    cues: ['interface design', 'compatibility layer', 'request shape', 'wrong shape', 'translation'],
    moduleIds: ['foundations-interface-principle'],
  },
  {
    topic: 'auditability',
    cues: ['audit trail', 'audit', 'reviewable', 'traceability', 'history'],
    moduleIds: [],
  },
  {
    topic: 'live updates',
    cues: ['live update', 'status updates', 'notify dashboards', 'event fan-out'],
    moduleIds: [],
  },
  {
    topic: 'queued work',
    cues: ['queued', 'retry', 'job', 'stored for later', 'replay'],
    moduleIds: [],
  },
  {
    topic: 'policy variation',
    cues: ['policy', 'rules vary', 'decision rules', 'tenant-specific', 'department-specific'],
    moduleIds: [],
  },
];

export function normalizePatternText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPatternTokens(text: string): string[] {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4),
  ));
}

export function uniquePatternStrings(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

export interface PatternPhraseHitResult {
  score: number;
  matchedEvidence: string[];
}

export function collectPatternPhraseHits(
  promptText: string,
  promptTokens: string[],
  phrases: ReadonlyArray<string>,
  weight: number,
  prefix: string,
): PatternPhraseHitResult {
  let score = 0;
  const evidence: string[] = [];

  for (const phrase of uniquePatternStrings(phrases)) {
    const normalizedPhrase = normalizePatternText(phrase);
    if (!normalizedPhrase) continue;

    const phraseTokens = extractPatternTokens(phrase);
    const exactMatch = promptText.includes(normalizedPhrase);
    const tokenMatch = phraseTokens.length >= 2 && phraseTokens.every((token) => promptTokens.includes(token));
    if (!exactMatch && !tokenMatch) continue;

    score += weight;
    evidence.push(`${prefix}:${phrase}`);
  }

  return {
    score,
    matchedEvidence: uniquePatternStrings(evidence),
  };
}

export function scorePatternEvidence(
  prompt: string,
  pattern: PatternEvidencePattern,
  guide?: PatternEvidenceGuide,
  cues: ReadonlyArray<string> = [],
): PatternEvidenceResult {
  const promptText = normalizePatternText(prompt);
  const promptTokens = extractPatternTokens(prompt);

  let score = 0;
  const matchedEvidence: string[] = [];

  const slugHit = promptText.includes(normalizePatternText(pattern.slug.replace(/-/g, ' ')));
  const nameHit = promptText.includes(normalizePatternText(pattern.name));
  if (slugHit) {
    score += 10;
    matchedEvidence.push(`name:${pattern.slug}`);
  }
  if (nameHit && pattern.name.toLowerCase() !== pattern.slug.replace(/-/g, ' ')) {
    score += 10;
    matchedEvidence.push(`title:${pattern.name}`);
  }

  const signalHits = collectPatternPhraseHits(promptText, promptTokens, pattern.signals, 7, 'signal');
  score += signalHits.score;
  matchedEvidence.push(...signalHits.matchedEvidence);

  const cueHits = collectPatternPhraseHits(promptText, promptTokens, cues, 6, 'cue');
  score += cueHits.score;
  matchedEvidence.push(...cueHits.matchedEvidence);

  if (guide) {
    const neededWhenHits = collectPatternPhraseHits(promptText, promptTokens, guide.neededWhen, 4, 'useWhen');
    const subScenarioHits = collectPatternPhraseHits(promptText, promptTokens, guide.subScenarios, 4, 'scenario');
    const neededConceptHits = collectPatternPhraseHits(promptText, promptTokens, guide.neededConcepts, 2, 'concept');
    const selectionTestHits = collectPatternPhraseHits(promptText, promptTokens, guide.selectionTest ? [guide.selectionTest] : [], 3, 'test');
    const distinguishHits = collectPatternPhraseHits(promptText, promptTokens, guide.distinguishFrom, 1, 'contrast');
    const mainConceptHits = collectPatternPhraseHits(promptText, promptTokens, guide.mainConcept ? [guide.mainConcept] : [], 1, 'concept');

    score += neededWhenHits.score;
    score += subScenarioHits.score;
    score += neededConceptHits.score;
    score += selectionTestHits.score;
    score += distinguishHits.score;
    score += mainConceptHits.score;

    matchedEvidence.push(
      ...neededWhenHits.matchedEvidence,
      ...subScenarioHits.matchedEvidence,
      ...neededConceptHits.matchedEvidence,
      ...selectionTestHits.matchedEvidence,
      ...distinguishHits.matchedEvidence,
      ...mainConceptHits.matchedEvidence,
    );
  }

  return {
    score,
    matchedEvidence: uniquePatternStrings(matchedEvidence),
  };
}
