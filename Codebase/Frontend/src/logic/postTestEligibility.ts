// Centralized, cycle-scoped Post-Test eligibility.
//
// One pure function decides whether the Post-Test paired with a SPECIFIC
// learning cycle's Pre-Test may be released. It is the single source of truth
// consumed by the learner Post-Test card, the Post-Test page gate, and the
// Project Manager dashboard, so those surfaces can never drift apart.
//
// Guarantees enforced here:
//  - Pairing is strictly by cycleId (never "latest" globally). Required modules,
//    the frozen scope, and the learning-gain comparison all come from the SAME
//    cycle's Pre-Test.
//  - Required modules reuse the existing review-recommendation logic
//    (requiredModuleIdsFromPretestScore) — no second threshold is introduced.
//  - Optional / already-understood modules are NEVER in the unlock denominator
//    (they are not "required", so they cannot appear in remainingModuleIds).
//  - The Post-Test still COVERS the full frozen module set (required + optional)
//    so the before/after comparison stays valid — coverage ≠ unlock gate.
//  - A frozen module missing its Form B is a configuration issue, never a
//    silently-partial Post-Test.
//
// Server-side guards (ownership, one-formal-type-per-cycle, post-requires-pre)
// live in the assessments route + a DB uniqueness constraint; this function is
// the grading-aware layer (the question bank is frontend-only by design).

import {
  scoreStoredObjectiveAssessmentForCycle,
  computeLearningGain,
  type AssessmentScore,
  type LearningGain,
} from '../data/learningAssessments';
import type { LearningModule } from '../data/learningModules';
import { startPosttestForCycle, type CycleErrorCode } from '../data/assessmentCycle';
import { requiredModuleIdsFromPretestScore } from './internLearningStatus';
import type { LearningAssessmentsResponse, LearningAssessmentAttemptRaw } from '../types/api';
import type { LearningProgress } from '../api/client';

export type PostTestStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'config_issue';

// reasonCode is a stable, non-sensitive machine code. It reuses the cycle error
// codes where they apply and adds gate-specific codes.
export type PostTestReasonCode =
  | CycleErrorCode
  | 'NO_CYCLE'
  | 'MODULES_INCOMPLETE'
  | 'AVAILABLE'
  | 'COMPLETED'
  | 'IN_PROGRESS';

export interface PostTestEligibility {
  eligible: boolean;
  status: PostTestStatus;
  cycleId: string | null;
  preTestAttemptId: number | null;
  postTestAttemptId: number | null;
  requiredModuleCount: number;
  completedRequiredModuleCount: number;
  remainingModuleIds: string[];
  // Full frozen module set the paired Post-Test must cover (required + optional).
  frozenModuleIds: string[];
  coveredModuleCount: number;
  // Config-issue detail: frozen modules missing a complete Form B.
  missingFormBModuleIds: string[];
  reasonCode: PostTestReasonCode;
  reasonMessage: string;
}

const REASON_MESSAGE: Record<PostTestReasonCode, string> = {
  NO_CYCLE: 'No learning cycle with a submitted Pre-Test was found.',
  NO_PAIRED_PRETEST: 'Complete the Pre-Test for this cycle before the Post-Test can be released.',
  MODULES_INCOMPLETE: 'Complete all required modules to unlock the Post-Test.',
  AVAILABLE: 'You completed all required learning activities. The Post-Test is available.',
  COMPLETED: 'The Post-Test for this cycle has been completed.',
  IN_PROGRESS: 'The Post-Test for this cycle is in progress.',
  INCOMPLETE_FORM_B: 'One or more modules in this cycle have no Post-Test (Form B) questions configured. Ask an administrator to author the missing forms.',
  MODULE_SET_MISMATCH: 'The Post-Test could not be rebuilt for the exact module set used by the Pre-Test. Ask an administrator to check the assessment configuration.',
  FORM_OVERLAP: 'A module has overlapping Pre-Test and Post-Test questions. The forms must be distinct before the Post-Test can run.',
  NO_ACTIVE_PLAN: 'No active learning plan is associated with this cycle.',
  NO_APPROVED_MODULES: 'This cycle has no approved modules.',
  INCOMPLETE_FORM_A: 'This cycle is missing Pre-Test (Form A) questions.',
  NO_ASSESSMENT_QUESTIONS: 'No assessment questions are configured for this cycle.',
};

function reasonMessageFor(code: PostTestReasonCode): string {
  return REASON_MESSAGE[code] ?? 'Post-Test is not available.';
}

function findAttemptId(
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>,
  type: 'pretest' | 'posttest',
  cycleId: string,
): number | null {
  const found = attempts.find((a) => a.assessmentType === type && a.cycleId === cycleId);
  return found ? found.id : null;
}

/**
 * Resolve the learning cycle the learner is currently working toward for the
 * Post-Test: the most recent Pre-Test cycle. Pairing inside getPostTestEligibility
 * is still strictly cycle-scoped — this only chooses WHICH cycle a no-argument
 * surface (e.g. the dashboard) should display, never which Pre-Test to grade
 * against.
 */
export function resolvePostTestCycleId(assessments: LearningAssessmentsResponse): string | null {
  const pretests = assessments.attempts
    .filter((a) => a.assessmentType === 'pretest' && a.cycleId)
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id - b.id);
  return pretests[pretests.length - 1]?.cycleId ?? null;
}

export interface PostTestEligibilityInput {
  modules: ReadonlyArray<LearningModule>;
  assessments: LearningAssessmentsResponse;
  progress: Pick<LearningProgress, 'completedModuleIds'>;
  cycleId: string | null;
  // Optional UI signal: the learner has an open, unsubmitted Post-Test for this
  // cycle (transient client state — attempts are persisted only on submit).
  hasInProgressAttempt?: boolean;
}

export function getPostTestEligibility(input: PostTestEligibilityInput): PostTestEligibility {
  const { modules, assessments, progress, cycleId, hasInProgressAttempt } = input;

  const base = (over: Partial<PostTestEligibility>): PostTestEligibility => ({
    eligible: false,
    status: 'locked',
    cycleId,
    preTestAttemptId: cycleId ? findAttemptId(assessments.attempts, 'pretest', cycleId) : null,
    postTestAttemptId: cycleId ? findAttemptId(assessments.attempts, 'posttest', cycleId) : null,
    requiredModuleCount: 0,
    completedRequiredModuleCount: 0,
    remainingModuleIds: [],
    frozenModuleIds: [],
    coveredModuleCount: 0,
    missingFormBModuleIds: [],
    reasonCode: 'NO_CYCLE',
    reasonMessage: reasonMessageFor('NO_CYCLE'),
    ...over,
    ...(over.reasonCode ? { reasonMessage: over.reasonMessage ?? reasonMessageFor(over.reasonCode) } : {}),
  });

  // 1. A cycle must exist.
  if (!cycleId) return base({ status: 'locked', reasonCode: 'NO_CYCLE' });

  // 2. A submitted Pre-Test must exist for THIS exact cycle.
  const preTestAttemptId = findAttemptId(assessments.attempts, 'pretest', cycleId);
  if (preTestAttemptId === null) {
    return base({ status: 'locked', reasonCode: 'NO_PAIRED_PRETEST' });
  }

  // 3. The frozen module scope must be recoverable (graded from the Pre-Test's
  //    own stored answers — never the current plan or all modules).
  const preScore: AssessmentScore | null = scoreStoredObjectiveAssessmentForCycle(
    modules,
    assessments,
    'pretest',
    cycleId,
  );
  if (!preScore || Object.keys(preScore.byModule).length === 0) {
    return base({ status: 'config_issue', reasonCode: 'MODULE_SET_MISMATCH' });
  }
  const frozenModuleIds = Object.keys(preScore.byModule);

  // 6. Already completed → terminal state (no further attempt may be created).
  const postTestAttemptId = findAttemptId(assessments.attempts, 'posttest', cycleId);
  if (postTestAttemptId !== null) {
    return base({
      eligible: false,
      status: 'completed',
      preTestAttemptId,
      postTestAttemptId,
      frozenModuleIds,
      coveredModuleCount: frozenModuleIds.length,
      reasonCode: 'COMPLETED',
    });
  }

  // 4. Required modules (cycle-scoped, single threshold). Optional / already-
  //    understood modules are excluded by construction (they are not required),
  //    so they can never enter remainingModuleIds.
  const requiredModuleIds = requiredModuleIdsFromPretestScore(preScore);
  const completedSet = new Set(progress.completedModuleIds);
  const completedRequired = requiredModuleIds.filter((id) => completedSet.has(id));
  const remainingModuleIds = requiredModuleIds.filter((id) => !completedSet.has(id));

  const partial = {
    preTestAttemptId,
    postTestAttemptId: null,
    requiredModuleCount: requiredModuleIds.length,
    completedRequiredModuleCount: completedRequired.length,
    remainingModuleIds,
    frozenModuleIds,
    coveredModuleCount: frozenModuleIds.length,
  };

  // 5. Form B must exist for the FULL frozen scope, or it is a configuration
  //    issue (never a silently-partial Post-Test). startPosttestForCycle builds
  //    for the exact frozen set, so it also validates module-set reproducibility
  //    and A/B overlap.
  const built = startPosttestForCycle({
    cycleId,
    modules,
    attempts: assessments.attempts,
    answers: assessments.answers,
  });
  if (!built.ok && built.error !== 'NO_PAIRED_PRETEST') {
    return base({
      ...partial,
      status: 'config_issue',
      reasonCode: built.error,
      missingFormBModuleIds: built.error === 'INCOMPLETE_FORM_B' ? built.modules ?? [] : [],
    });
  }

  // Required modules still incomplete → locked.
  if (remainingModuleIds.length > 0) {
    return base({ ...partial, status: 'locked', reasonCode: 'MODULES_INCOMPLETE' });
  }

  // In-progress (transient, client-supplied): resume the existing attempt.
  if (hasInProgressAttempt) {
    return base({ ...partial, eligible: true, status: 'in_progress', reasonCode: 'IN_PROGRESS' });
  }

  // Available: all required activities complete and Form B is ready.
  return base({ ...partial, eligible: true, status: 'available', reasonCode: 'AVAILABLE' });
}

/**
 * Paired learning gain for a completed Post-Test: ALWAYS compares the Post-Test
 * against the Pre-Test of the SAME cycle (never latestAttemptOfType). Returns
 * null when either side is unavailable.
 */
export function pairedLearningGain(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
  cycleId: string,
): { pre: AssessmentScore; post: AssessmentScore; gain: LearningGain } | null {
  const pre = scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'pretest', cycleId);
  const post = scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'posttest', cycleId);
  if (!pre || !post) return null;
  return { pre, post, gain: computeLearningGain(pre, post) };
}
