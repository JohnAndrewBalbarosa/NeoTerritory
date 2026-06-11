import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PATTERN_CATALOG } from './coursePlannerService';
import { ProjectLearningScope, ToggleManifest, Toggle } from './projectLearningContracts';

interface TogglePolicyPattern {
  slug: string;
  toggleKey: string;
  aliases?: string[];
  moduleHints?: string[];
}

interface TogglePolicyTopic {
  topic: string;
  toggleKey: string;
  aliases?: string[];
}

export interface ProjectLearningTogglePolicyConfig {
  schemaVersion: number;
  patterns: TogglePolicyPattern[];
  topics: TogglePolicyTopic[];
}

let cachedPolicy: ProjectLearningTogglePolicyConfig | null = null;

function normalizeKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function policyFileCandidates(): string[] {
  return [
    join(__dirname, '..', 'config', 'projectLearningTogglePolicy.json'),
    join(process.cwd(), 'src', 'config', 'projectLearningTogglePolicy.json'),
    join(process.cwd(), 'Codebase', 'Backend', 'src', 'config', 'projectLearningTogglePolicy.json'),
  ];
}

function readPolicyJson(): unknown {
  const path = policyFileCandidates().find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error('projectLearningTogglePolicy.json was not found in the backend config paths.');
  }
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertPolicyConfig(value: unknown): asserts value is ProjectLearningTogglePolicyConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('projectLearningTogglePolicy.json must be an object.');
  }
  const config = value as ProjectLearningTogglePolicyConfig;
  if (config.schemaVersion !== 1) {
    throw new Error('projectLearningTogglePolicy.json schemaVersion must be 1.');
  }
  if (!Array.isArray(config.patterns) || !Array.isArray(config.topics)) {
    throw new Error('projectLearningTogglePolicy.json must define patterns and topics arrays.');
  }

  const catalogSlugs = new Set(PATTERN_CATALOG.map((pattern) => pattern.slug));
  const configSlugs = new Set<string>();
  for (const pattern of config.patterns) {
    if (!pattern || typeof pattern.slug !== 'string' || typeof pattern.toggleKey !== 'string') {
      throw new Error('Each pattern toggle policy entry must define slug and toggleKey.');
    }
    if (!pattern.toggleKey.startsWith('pattern.')) {
      throw new Error(`Pattern ${pattern.slug} must use a pattern.* toggle key.`);
    }
    if (pattern.aliases != null && !isStringArray(pattern.aliases)) {
      throw new Error(`Pattern ${pattern.slug} aliases must be a string array.`);
    }
    if (pattern.moduleHints != null && !isStringArray(pattern.moduleHints)) {
      throw new Error(`Pattern ${pattern.slug} moduleHints must be a string array.`);
    }
    configSlugs.add(pattern.slug);
  }

  const missing = Array.from(catalogSlugs).filter((slug) => !configSlugs.has(slug));
  if (missing.length > 0) {
    throw new Error(`projectLearningTogglePolicy.json is missing catalog patterns: ${missing.join(', ')}`);
  }

  for (const topic of config.topics) {
    if (!topic || typeof topic.topic !== 'string' || typeof topic.toggleKey !== 'string') {
      throw new Error('Each topic toggle policy entry must define topic and toggleKey.');
    }
    if (!topic.toggleKey.startsWith('topic.')) {
      throw new Error(`Topic ${topic.topic} must use a topic.* toggle key.`);
    }
    if (topic.aliases != null && !isStringArray(topic.aliases)) {
      throw new Error(`Topic ${topic.topic} aliases must be a string array.`);
    }
  }
}

export function loadTogglePolicyConfig(): ProjectLearningTogglePolicyConfig {
  if (cachedPolicy) return cachedPolicy;
  const parsed = readPolicyJson();
  assertPolicyConfig(parsed);
  cachedPolicy = parsed;
  return cachedPolicy;
}

function uniqueToggles(entries: ReadonlyArray<{ toggleKey: string }>): string[] {
  return Array.from(new Set(entries.map((entry) => entry.toggleKey)));
}

function patternMatchesScope(entry: TogglePolicyPattern, scope: ProjectLearningScope): boolean {
  const requiredPatterns = scope.requiredPatterns.map(normalizeKey);
  const requiredModules = scope.requiredModules.map(normalizeKey);
  const candidates = [entry.slug, ...(entry.aliases ?? []), ...(entry.moduleHints ?? [])].map(normalizeKey);
  return candidates.some((candidate) => requiredPatterns.includes(candidate))
    || candidates.some((candidate) => requiredModules.some((moduleId) => moduleId.includes(candidate)));
}

function topicMatchesScope(entry: TogglePolicyTopic, scope: ProjectLearningScope): boolean {
  const requiredTopics = (scope.requiredTopics || []).map(normalizeKey);
  const candidates = [entry.topic, entry.toggleKey.replace(/^topic\./, ''), ...(entry.aliases ?? [])].map(normalizeKey);
  return candidates.some((candidate) => requiredTopics.includes(candidate));
}

function patternIsExcluded(entry: TogglePolicyPattern, scope: ProjectLearningScope): boolean {
  const excludedPatterns = scope.excludedPatterns.map(normalizeKey);
  const candidates = [entry.slug, ...(entry.aliases ?? [])].map(normalizeKey);
  return candidates.some((candidate) => excludedPatterns.includes(candidate));
}

export function resolveTogglePolicy(scope: ProjectLearningScope): ToggleManifest {
  const config = loadTogglePolicyConfig();
  const patternToggleByKey = new Map(config.patterns.map((entry) => [entry.toggleKey, entry]));
  const topicToggleByKey = new Map(config.topics.map((entry) => [entry.toggleKey, entry]));
  const toggleKeys = uniqueToggles([...config.patterns, ...config.topics]);

  const toggles: Toggle[] = toggleKeys.map((key) => {
    const pattern = patternToggleByKey.get(key);
    if (pattern) {
      return {
        key,
        enabled: patternMatchesScope(pattern, scope) && !patternIsExcluded(pattern, scope),
      };
    }

    const topic = topicToggleByKey.get(key);
    return {
      key,
      enabled: topic ? topicMatchesScope(topic, scope) : false,
    };
  });

  return {
    projectId: scope.projectId,
    scopeVersion: scope.scopeVersion,
    toggles,
    implicitDeny: true,
    status: 'applied',
  };
}

export function buildImplicitDenyManifest(scope: ProjectLearningScope): ToggleManifest {
  return resolveTogglePolicy(scope);
}
