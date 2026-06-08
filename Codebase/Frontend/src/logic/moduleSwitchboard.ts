import type { AdminCoursePlanModuleDecision, AdminLearningModule } from '../types/api';
import type { LearningModule } from '../data/learningModules';

export type ModuleSwitchState = 'on' | 'off';

export interface ModuleSwitchRow {
  moduleId: string;
  title: string;
  category: string;
  currentState: ModuleSwitchState;
  effectiveState: ModuleSwitchState;
  currentPublished: boolean;
  effectivePublished: boolean;
  reason: string;
  matchedSections: string[];
  matchedTopics: string[];
}

export interface ModuleSwitchCounts {
  on: number;
  off: number;
}

function stateOf(value: boolean): ModuleSwitchState {
  return value ? 'on' : 'off';
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function buildModuleSwitchboard(
  modules: ReadonlyArray<AdminLearningModule | LearningModule>,
  plan: ReadonlyArray<AdminCoursePlanModuleDecision> | null | undefined = null,
): ModuleSwitchRow[] {
  const planById = new Map((plan ?? []).map((entry) => [entry.moduleId, entry]));
  return modules.map((module) => {
    const hasPublishedField = Object.prototype.hasOwnProperty.call(module, 'published');
    const currentPublished = hasPublishedField ? Boolean((module as AdminLearningModule).published) : true;
    const chosen = planById.get(module.id);
    const effectivePublished = chosen?.published ?? currentPublished;
    return {
      moduleId: module.id,
      title: module.title,
      category: module.category,
      currentState: stateOf(currentPublished),
      effectiveState: stateOf(effectivePublished),
      currentPublished,
      effectivePublished,
      reason: normalizeText(chosen?.reason, currentPublished ? 'Current module stays ON.' : 'Current module stays OFF.'),
      matchedSections: normalizeList(chosen?.matchedSections),
      matchedTopics: normalizeList(chosen?.matchedTopics),
    };
  });
}

export function countSwitchboard(rows: ReadonlyArray<ModuleSwitchRow>): ModuleSwitchCounts {
  return rows.reduce<ModuleSwitchCounts>(
    (acc, row) => {
      acc[row.effectiveState] += 1;
      return acc;
    },
    { on: 0, off: 0 },
  );
}

export function filterVisibleLearningModules<T extends { published?: boolean }>(
  modules: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return modules.filter((module) => module.published === true);
}
