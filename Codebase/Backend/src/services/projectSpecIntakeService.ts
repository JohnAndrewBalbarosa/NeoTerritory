import { listLearningModuleCatalog } from './learningModuleCatalog';
import {
  BUSINESS_PATTERN_SELECTION_LIMIT,
  PATTERN_CATALOG,
  PATTERN_CONTEXT_GUIDE,
  scorePatternMatch,
} from './coursePlannerService';
import { ProjectBriefInput, ProjectLearningScope } from './projectLearningContracts';

interface RankedPatternMatch {
  patternId: string;
  patternName: string;
  score: number;
  cueMatches: number;
  reason: string;
  topics: string[];
  moduleIds: string[];
}

const PATTERN_TOPIC_HINTS: Record<string, string[]> = {
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

const TOPIC_GROUPS: Array<{ topic: string; cues: string[]; moduleIds: string[] }> = [
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

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[`"'()[\]{}:,./\\<>!?;=+\-*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBriefText(input: ProjectBriefInput): string {
  return normalizeText([
    input.projectTitle,
    ...(input.businessSpecs || []),
    ...(input.architectureSpecs || []),
    input.businessProcess || '',
  ].join(' '));
}

function uniqueStrings(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

function scorePattern(text: string, patternId: string): RankedPatternMatch {
  const pattern = PATTERN_CATALOG.find((entry) => entry.slug === patternId);
  if (!pattern) {
    return {
      patternId,
      patternName: patternId,
      score: 0,
      cueMatches: 0,
      reason: '',
      topics: [],
      moduleIds: [],
    };
  }

  const guide = PATTERN_CONTEXT_GUIDE[pattern.slug];
  const cueMatches = matchedCueCount(text, pattern.slug);
  const score = scorePatternMatch(text, pattern) + boostPatternScore(text, pattern.slug, pattern.name) + (cueMatches * 6);
  const reason = buildPatternReason(text, pattern.slug, guide);
  const topics = topicHintsForPattern(pattern.slug);
  const moduleIds = resolveModuleIdsForPattern(pattern.slug);
  return {
    patternId: pattern.slug,
    patternName: pattern.name,
    score,
    cueMatches,
    reason,
    topics,
    moduleIds,
  };
}

function boostPatternScore(text: string, patternSlug: string, patternName: string): number {
  let score = 0;
  const normalized = normalizeText(text);
  if (normalized.includes(patternSlug.replace(/-/g, ' '))) score += 4;
  if (normalized.includes(patternName.toLowerCase())) score += 4;
  for (const hint of PATTERN_TOPIC_HINTS[patternSlug] || []) {
    if (normalized.includes(hint)) score += 2;
  }
  return score;
}

function matchedCueCount(text: string, patternSlug: string): number {
  const normalized = normalizeText(text);
  return (PATTERN_TOPIC_HINTS[patternSlug] || []).filter((hint) => normalized.includes(hint)).length;
}

function buildPatternReason(text: string, patternSlug: string, guide: (typeof PATTERN_CONTEXT_GUIDE)[string] | undefined): string {
  const normalized = normalizeText(text);
  const cues = PATTERN_TOPIC_HINTS[patternSlug] || [];
  const matchedCue = cues.find((cue) => normalized.includes(cue));
  if (matchedCue) {
    return cueToReason(patternSlug, matchedCue);
  }
  if (guide?.selectionTest) {
    return guide.selectionTest.replace(/\?$/, '').trim();
  }
  return `The brief fits ${patternSlug} better than the broader catalog.`;
}

function cueToReason(patternSlug: string, cue: string): string {
  const templates: Record<string, string> = {
    adapter: `External partners use a different shape, so the brief needs a translation layer for ${cue}.`,
    facade: `Several backend steps need one simple front door, so the brief should hide ${cue} behind a facade.`,
    strategy: `The rules vary by department or contract, so the brief needs a swappable decision policy for ${cue}.`,
    observer: `State changes need to reach multiple views, so ${cue} should fan out through observers.`,
    command: `The work needs to be queued or replayed, so ${cue} fits command-style actions.`,
    proxy: `Access and timing need control, so ${cue} fits a proxy boundary.`,
    decorator: `Optional behavior should stack without changing the base interface, so ${cue} fits decoration.`,
    composite: `Tree-like parts need one uniform operation, so ${cue} points at composite.`,
  };
  return templates[patternSlug] || `The brief matches ${patternSlug} through ${cue}.`;
}

function topicHintsForPattern(patternSlug: string): string[] {
  return PATTERN_TOPIC_HINTS[patternSlug] || [];
}

function resolveModuleIdsForPattern(patternSlug: string): string[] {
  const catalog = listLearningModuleCatalog({ includeUnpublished: true });
  const normalizedSlug = patternSlug.toLowerCase();
  const suffixHints = [
    normalizedSlug,
    normalizedSlug.replace(/-/g, ''),
    normalizedSlug.replace(/-/g, ' '),
    normalizedSlug === 'factory-method' ? 'factory' : normalizedSlug,
  ].filter((value) => value.length > 0);

  return uniqueStrings(
    catalog
      .map((module) => module.moduleId)
      .filter((moduleId) => {
        const normalized = normalizeText(moduleId);
        return suffixHints.some((hint) => normalized.includes(hint.replace(/\s+/g, ' ')));
      }),
  );
}

function rankPatterns(text: string): RankedPatternMatch[] {
  return PATTERN_CATALOG
    .map((pattern) => scorePattern(text, pattern.slug))
    .sort((left, right) => right.score - left.score || left.patternName.localeCompare(right.patternName));
}

function selectPatterns(text: string): RankedPatternMatch[] {
  const ranked = rankPatterns(text);
  const bestScore = ranked[0]?.score ?? 0;
  const threshold = Math.max(4, Math.round(bestScore * 0.55));
  const selected = ranked
    .filter((item) => item.cueMatches > 0)
    .filter((item) => item.score >= threshold)
    .slice(0, BUSINESS_PATTERN_SELECTION_LIMIT);
  return selected.length > 0 ? selected : ranked.slice(0, Math.min(1, ranked.length));
}

function buildRequiredTopics(text: string, selectedPatterns: RankedPatternMatch[]): string[] {
  const groupTopics = TOPIC_GROUPS
    .filter((group) => group.cues.some((cue) => text.includes(cue)))
    .map((group) => group.topic);
  const patternTopics = selectedPatterns.flatMap((pattern) => pattern.topics);
  return uniqueStrings([...patternTopics, ...groupTopics]).slice(0, 8);
}

function mapTopicsToModules(topics: string[]): string[] {
  const catalog = listLearningModuleCatalog({ includeUnpublished: true });
  const matchingGroups = TOPIC_GROUPS.filter((group) => topics.some((topic) => topic === group.topic));
  const moduleIds = matchingGroups.flatMap((group) => group.moduleIds);
  const normalizedTopicText = normalizeText(topics.join(' '));

  const inferred = catalog
    .filter((module) => {
      const normalizedTitle = normalizeText(module.title);
      return normalizedTopicText.includes('interface') && normalizedTitle.includes('interface')
        || normalizedTopicText.includes('boundary') && normalizedTitle.includes('structure');
    })
    .map((module) => module.moduleId);

  return uniqueStrings([...moduleIds, ...inferred]);
}

export function intakeProjectBrief(input: ProjectBriefInput): ProjectLearningScope {
  const briefText = buildBriefText(input);
  const selectedPatterns = selectPatterns(briefText);
  const requiredPatterns = selectedPatterns.map((pattern) => pattern.patternId);
  const requiredTopics = buildRequiredTopics(briefText, selectedPatterns);
  const excludedPatterns = extractExcludedPatterns(briefText, requiredPatterns);
  const requiredModules = uniqueStrings([
    ...selectedPatterns.flatMap((pattern) => pattern.moduleIds),
    ...mapTopicsToModules(requiredTopics),
  ]);

  return {
    projectId: input.projectId,
    scopeVersion: `scope-${Math.floor(Math.random() * 1000)}`,
    requiredPatterns,
    requiredModules,
    requiredTopics,
    excludedPatterns,
    notes: [
      'implicit deny applied',
      ...selectedPatterns.map((pattern) => `${pattern.patternName}: ${pattern.reason}`),
    ],
    confidence: selectedPatterns.length >= 4 ? 'high' : selectedPatterns.length >= 2 ? 'medium' : 'low',
    status: 'normalized',
  };
}

function extractExcludedPatterns(text: string, selectedPatterns: string[]): string[] {
  const cues = ['avoid', 'no', "don't use", 'do not use', 'without', 'exclude'];
  const selectedSet = new Set(selectedPatterns);
  return PATTERN_CATALOG
    .map((pattern) => pattern.slug)
    .filter((pattern) => !selectedSet.has(pattern))
    .filter((pattern) => cues.some((cue) => text.includes(`${cue} ${pattern.replace(/-/g, ' ')}`) || text.includes(`${cue} ${pattern}`)));
}

export function normalizeProjectLearningScope(parsedInput: ProjectLearningScope): ProjectLearningScope {
  return {
    ...parsedInput,
    status: 'normalized',
  };
}
