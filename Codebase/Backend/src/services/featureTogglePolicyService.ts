import { ProjectLearningScope, ToggleManifest, Toggle } from './projectLearningContracts';

const ALL_PATTERN_TOGGLES = [
  'pattern.adapter',
  'pattern.facade',
  'pattern.strategy',
  'pattern.observer',
  'pattern.command',
  'pattern.proxy',
  'pattern.decorator',
  'pattern.composite',
  'pattern.singleton',
  'pattern.builder',
  'pattern.factory-method',
  'pattern.abstract-factory',
  'pattern.method-chaining',
  'pattern.bridge',
  'pattern.chain-of-responsibility',
  'pattern.mediator',
  'pattern.visitor',
  'pattern.interpreter',
  'pattern.memento',
  'pattern.state',
  'pattern.iterator',
  'pattern.repository',
  'pattern.pimpl',
  'pattern.prototype',
  'pattern.flyweight',
];

const ALL_TOPIC_TOGGLES = [
  'topic.module-boundaries',
  'topic.dependency-direction',
  'topic.interface-design',
  'topic.auditability',
  'topic.live-updates',
  'topic.queued-work',
  'topic.policy-variation',
];

const ALL_POTENTIAL_TOGGLES = [...ALL_PATTERN_TOGGLES, ...ALL_TOPIC_TOGGLES];

function normalizeKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function resolveTogglePolicy(scope: ProjectLearningScope): ToggleManifest {
  const toggles: Toggle[] = ALL_POTENTIAL_TOGGLES.map((key) => {
    const isRequired = isKeyInScope(key, scope);
    const isExcluded = isKeyExcluded(key, scope);

    return {
      key,
      enabled: isRequired && !isExcluded,
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

function isKeyInScope(key: string, scope: ProjectLearningScope): boolean {
  const [type, name] = key.split('.');
  if (type === 'pattern') {
    return scope.requiredPatterns.some((pattern) => normalizeKey(pattern) === name)
      || scope.requiredModules.some((moduleId) => normalizeKey(moduleId).includes(name));
  }
  if (type === 'topic') {
    return (scope.requiredTopics || []).some((topic) => normalizeKey(topic) === name);
  }
  return false;
}

function isKeyExcluded(key: string, scope: ProjectLearningScope): boolean {
  const [type, name] = key.split('.');
  if (type === 'pattern') {
    return scope.excludedPatterns.some((pattern) => normalizeKey(pattern) === name);
  }
  return false;
}

export function buildImplicitDenyManifest(scope: ProjectLearningScope): ToggleManifest {
  return resolveTogglePolicy(scope);
}
