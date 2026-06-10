import { listLearningModuleCatalog } from './learningModuleCatalog';
import {
  BUSINESS_PATTERN_SELECTION_LIMIT,
  PATTERN_CATALOG,
  PATTERN_CONTEXT_GUIDE,
} from './coursePlannerService';
import { ProjectBriefInput, ProjectLearningScope } from './projectLearningContracts';
import {
  PATTERN_EVIDENCE_HINTS,
  TOPIC_GROUPS,
  normalizePatternText,
  scorePatternEvidence,
  uniquePatternStrings,
} from './patternEvidenceService';

interface RankedPatternMatch {
  patternId: string;
  patternName: string;
  score: number;
  cueMatches: number;
  reason: string;
  topics: string[];
  moduleIds: string[];
}

function buildBriefText(input: ProjectBriefInput): string {
  return normalizePatternText([
    input.projectTitle,
    ...(input.businessSpecs || []),
    ...(input.architectureSpecs || []),
    input.businessProcess || '',
  ].join(' '));
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
  const score = scorePatternEvidence(text, pattern, guide, PATTERN_EVIDENCE_HINTS[pattern.slug] ?? []).score + boostPatternScore(text, pattern.slug, pattern.name) + (cueMatches * 6);
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
  const normalized = normalizePatternText(text);
  if (normalized.includes(patternSlug.replace(/-/g, ' '))) score += 4;
  if (normalized.includes(patternName.toLowerCase())) score += 4;
  for (const hint of PATTERN_EVIDENCE_HINTS[patternSlug] || []) {
    if (normalized.includes(hint)) score += 2;
  }
  return score;
}

function matchedCueCount(text: string, patternSlug: string): number {
  const normalized = normalizePatternText(text);
  return (PATTERN_EVIDENCE_HINTS[patternSlug] || []).filter((hint) => normalized.includes(hint)).length;
}

function buildPatternReason(text: string, patternSlug: string, guide: (typeof PATTERN_CONTEXT_GUIDE)[string] | undefined): string {
  const normalized = normalizePatternText(text);
  const cues = PATTERN_EVIDENCE_HINTS[patternSlug] || [];
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
  return PATTERN_EVIDENCE_HINTS[patternSlug] || [];
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

  return uniquePatternStrings(
    catalog
      .map((module) => module.moduleId)
      .filter((moduleId) => {
        const normalized = normalizePatternText(moduleId);
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
  if (bestScore < 8) {
    return [];
  }

  const threshold = Math.max(8, Math.round(bestScore * 0.6));
  const selected = ranked
    .filter((item) => item.score >= threshold)
    .slice(0, BUSINESS_PATTERN_SELECTION_LIMIT);

  if (selected.length > 0) {
    return selected;
  }

  return ranked.length > 0 ? ranked.slice(0, Math.min(1, ranked.length)) : [];
}

function buildRequiredTopics(text: string, selectedPatterns: RankedPatternMatch[]): string[] {
  const groupTopics = TOPIC_GROUPS
    .filter((group) => group.cues.some((cue) => text.includes(cue)))
    .map((group) => group.topic);
  const patternTopics = selectedPatterns.flatMap((pattern) => pattern.topics);
  return uniquePatternStrings([...patternTopics, ...groupTopics]).slice(0, 8);
}

function mapTopicsToModules(topics: string[]): string[] {
  const catalog = listLearningModuleCatalog({ includeUnpublished: true });
  const matchingGroups = TOPIC_GROUPS.filter((group) => topics.some((topic) => topic === group.topic));
  const moduleIds = matchingGroups.flatMap((group) => group.moduleIds);
  const normalizedTopicText = normalizePatternText(topics.join(' '));

  const inferred = catalog
    .filter((module) => {
      const normalizedTitle = normalizePatternText(module.title);
      return normalizedTopicText.includes('interface') && normalizedTitle.includes('interface')
        || normalizedTopicText.includes('boundary') && normalizedTitle.includes('structure');
    })
    .map((module) => module.moduleId);

  return uniquePatternStrings([...moduleIds, ...inferred]);
}

export function intakeProjectBrief(input: ProjectBriefInput): ProjectLearningScope {
  const briefText = buildBriefText(input);
  const selectedPatterns = selectPatterns(briefText);
  const requiredPatterns = selectedPatterns.map((pattern) => pattern.patternId);
  const requiredTopics = buildRequiredTopics(briefText, selectedPatterns);
  const excludedPatterns = extractExcludedPatterns(briefText, requiredPatterns);
  const requiredModules = uniquePatternStrings([
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
