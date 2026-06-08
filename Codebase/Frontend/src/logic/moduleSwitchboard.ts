import type {
  AdminCoursePlan,
  AdminCoursePlanModuleDecision,
  AdminCoursePlanSectionDecision,
  AdminLearningModule,
} from '../types/api';
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

export interface ModuleSwitchSection {
  sectionId: string;
  section: string;
  rows: ModuleSwitchRow[];
  currentOn: number;
  currentOff: number;
  effectiveOn: number;
  effectiveOff: number;
}

type PlanShape =
  | ReadonlyArray<AdminCoursePlanModuleDecision>
  | Pick<AdminCoursePlan, 'modules' | 'sections'>
  | null
  | undefined;

function isPlanObject(plan: PlanShape): plan is Pick<AdminCoursePlan, 'modules' | 'sections'> {
  return Boolean(plan) && !Array.isArray(plan);
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

function flattenPlanModules(plan: PlanShape): ReadonlyArray<AdminCoursePlanModuleDecision> {
  if (!plan) return [];
  if (Array.isArray(plan)) return plan;
  if (isPlanObject(plan) && Array.isArray(plan.sections) && plan.sections.length > 0) {
    return plan.sections.flatMap((section: AdminCoursePlanSectionDecision) => section.modules);
  }
  return isPlanObject(plan) ? plan.modules ?? [] : [];
}

export function buildModuleSwitchboard(
  modules: ReadonlyArray<AdminLearningModule | LearningModule>,
  plan: PlanShape = null,
): ModuleSwitchRow[] {
  const planById = new Map(flattenPlanModules(plan).map((entry) => [entry.moduleId, entry]));
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

export function groupModuleSwitchboard(rows: ReadonlyArray<ModuleSwitchRow>): ModuleSwitchSection[] {
  const groups = new Map<string, ModuleSwitchSection>();
  for (const row of rows) {
    const group = groups.get(row.category) ?? {
      sectionId: row.category,
      section: row.category ? row.category.charAt(0).toUpperCase() + row.category.slice(1) : row.category,
      rows: [],
      currentOn: 0,
      currentOff: 0,
      effectiveOn: 0,
      effectiveOff: 0,
    };
    group.rows.push(row);
    if (row.currentPublished) group.currentOn += 1;
    else group.currentOff += 1;
    if (row.effectivePublished) group.effectiveOn += 1;
    else group.effectiveOff += 1;
    groups.set(row.category, group);
  }
  return Array.from(groups.values());
}

export function filterVisibleLearningModules<T extends { published?: boolean }>(
  modules: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return modules.filter((module) => module.published === true);
}
