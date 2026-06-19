// Formal assessment CYCLE logic: scope resolution + pre/post pairing.
//
// Authoritative scope = the learner's ACTIVE plan modules whose selection_status
// is 'approved' or 'added'. Never derived from progress, proficiency, all
// published modules, or all modules with forms.
//
// A pre-test and its paired post-test share one cycle_id. The post-test is built
// for the EXACT module set frozen by its paired pre-test (recovered from the
// pre-test's saved answers), never re-scoped from the current active plan and
// never paired by "latest". All functions are pure (cycle ids are injected) so
// they are deterministic and unit-testable.

import { normalizeLearningModules, type LearningModule } from './learningModules';
import { buildFormalAssessment, type LearningAssessmentQuestion } from './learningAssessments';
import type { LearningAssessmentAttemptRaw, LearningAssessmentAnswerRaw } from '../types/api';

// Each complete objective form has exactly this many questions.
export const FORM_SIZE = 5;

export type PlanSelectionStatus = 'recommended' | 'approved' | 'added' | 'rejected';
export interface LearningPlanModule {
  moduleId: string;
  selectionStatus: PlanSelectionStatus;
  recommendationSource?: 'ai' | 'project_manager' | 'system';
  displayOrder?: number | null;
}
export interface LearningPlan {
  id: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  modules: ReadonlyArray<LearningPlanModule>;
}

export type CycleErrorCode =
  | 'NO_ACTIVE_PLAN'
  | 'NO_APPROVED_MODULES'
  | 'INCOMPLETE_FORM_A'
  | 'INCOMPLETE_FORM_B'
  | 'FORM_OVERLAP'
  | 'NO_PAIRED_PRETEST'
  | 'MODULE_SET_MISMATCH';

export interface CycleFailure {
  ok: false;
  error: CycleErrorCode;
  modules?: string[];
}
export interface PretestCycle {
  ok: true;
  cycleId: string;
  planId: string | null;
  scope: string[];
  questions: LearningAssessmentQuestion[];
}
export interface PosttestCycle {
  ok: true;
  cycleId: string;
  scope: string[];
  questions: LearningAssessmentQuestion[];
}

// Approved/added modules of an ACTIVE plan, in display order. Empty for any
// non-active or absent plan.
export function approvedPlanModuleIds(plan: LearningPlan | null | undefined): string[] {
  if (!plan || plan.status !== 'active') return [];
  return [...plan.modules]
    .filter((m) => m.selectionStatus === 'approved' || m.selectionStatus === 'added')
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((m) => m.moduleId);
}

function formItemIds(module: LearningModule | undefined, form: 'A' | 'B'): string[] {
  return (module?.assessmentForms?.[form] ?? []).map((q) => q.id);
}
function formComplete(module: LearningModule | undefined, form: 'A' | 'B'): boolean {
  return (module?.assessmentForms?.[form]?.length ?? 0) === FORM_SIZE;
}

// Start a formal pre-test cycle. cycleId is injected by the caller (e.g.
// crypto.randomUUID()) so this stays pure. Validates an active plan, approved
// modules, complete Form A AND Form B, and zero A/B id overlap, then builds
// Form A for the approved set. If no active plan exists, it falls back to the
// full REQUIRED / "switched-on" module set the learner is served — every module
// passed in (the API returns published modules + baseline foundations; the
// static catalog is the offline fallback), not only the foundations category.
// The assessable scope is that required set intersected with the modules that
// have complete authored forms, so the pre-test grows automatically as more
// required modules get their parallel forms authored.
export function startPretestCycle(opts: {
  plan: LearningPlan | null | undefined;
  modules: ReadonlyArray<LearningModule>;
  cycleId: string;
}): PretestCycle | CycleFailure {
  const { plan, modules, cycleId } = opts;
  
  let scope: string[];
  let planId: string | null = null;

  if (plan && plan.status === 'active') {
    scope = approvedPlanModuleIds(plan);
    planId = plan.id;
  } else {
    // Required modules fallback when there is no active course plan: scope to
    // EVERY required / switched-on module the learner is served (the modules
    // arg already is that set), intersected with those that have complete
    // authored forms. Not restricted to the foundations category.
    scope = normalizeLearningModules(modules)
      .filter((m) => formComplete(m, 'A') && formComplete(m, 'B'))
      .map((m) => m.id);
  }

  if (scope.length === 0) return { ok: false, error: 'NO_APPROVED_MODULES' };

  const byId = new Map(normalizeLearningModules(modules).map((m) => [m.id, m]));
  const missingA: string[] = [];
  const missingB: string[] = [];
  const overlap: string[] = [];
  for (const id of scope) {
    const module = byId.get(id);
    if (!formComplete(module, 'A')) missingA.push(id);
    if (!formComplete(module, 'B')) missingB.push(id);
    const aIds = new Set(formItemIds(module, 'A'));
    if (formItemIds(module, 'B').some((bid) => aIds.has(bid))) overlap.push(id);
  }
  if (missingA.length) return { ok: false, error: 'INCOMPLETE_FORM_A', modules: missingA };
  if (missingB.length) return { ok: false, error: 'INCOMPLETE_FORM_B', modules: missingB };
  if (overlap.length) return { ok: false, error: 'FORM_OVERLAP', modules: overlap };

  const questions = buildFormalAssessment(modules, 'pretest', scope);
  return { ok: true, cycleId, planId, scope, questions };
}

// Recover the EXACT module set frozen by a cycle's pre-test, from that
// pre-test's saved answers. Null when there is no pre-test for the cycle.
export function pretestModuleSetForCycle(
  cycleId: string,
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>,
  answers: ReadonlyArray<LearningAssessmentAnswerRaw>,
): string[] | null {
  const pre = attempts.find((a) => a.assessmentType === 'pretest' && a.cycleId === cycleId);
  if (!pre) return null;
  const set = new Set<string>();
  for (const answer of answers) {
    if (answer.attemptId === pre.id) set.add(answer.moduleId);
  }
  return Array.from(set);
}

// Start the post-test for a cycle. Pairs strictly by cycle_id (never "latest"),
// uses the pre-test's frozen module set (never the current active plan), and
// rejects when no paired pre-test exists, Form B is incomplete, the module set
// can't be reproduced, or Form A/B ids overlap.
export function startPosttestForCycle(opts: {
  cycleId: string;
  modules: ReadonlyArray<LearningModule>;
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>;
  answers: ReadonlyArray<LearningAssessmentAnswerRaw>;
}): PosttestCycle | CycleFailure {
  const { cycleId, modules, attempts, answers } = opts;
  const preSet = pretestModuleSetForCycle(cycleId, attempts, answers);
  if (!preSet || preSet.length === 0) return { ok: false, error: 'NO_PAIRED_PRETEST' };

  const byId = new Map(normalizeLearningModules(modules).map((m) => [m.id, m]));
  const missingB = preSet.filter((id) => !formComplete(byId.get(id), 'B'));
  if (missingB.length) return { ok: false, error: 'INCOMPLETE_FORM_B', modules: missingB };

  const questions = buildFormalAssessment(modules, 'posttest', preSet);
  const builtSet = new Set(questions.map((q) => q.moduleId));
  if (builtSet.size !== preSet.length || !preSet.every((id) => builtSet.has(id))) {
    return { ok: false, error: 'MODULE_SET_MISMATCH' };
  }

  const aIds = new Set<string>();
  for (const id of preSet) formItemIds(byId.get(id), 'A').forEach((x) => aIds.add(x));
  if (questions.some((q) => q.questionId && aIds.has(q.questionId))) {
    return { ok: false, error: 'FORM_OVERLAP' };
  }

  return { ok: true, cycleId, scope: preSet, questions };
}
