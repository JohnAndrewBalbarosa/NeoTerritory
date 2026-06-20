import {
  scoreStoredObjectiveAssessment,
  scoreStoredObjectiveAssessmentForCycle,
  type AssessmentScore,
} from '../data/learningAssessments';

// A module is recommended for review unless the learner got a PERFECT pre-test
// score on it. Any missed question makes the module required (so e.g. an 81%
// overall result still recommends the modules behind the missed 19%). Only a
// 100% module is treated as optional.
export const REVIEW_REQUIRED_BELOW_PERCENT = 100;
import type { LearningModule } from '../data/learningModules';
import type { LearningAssessmentsResponse } from '../types/api';
import type { LearningProgress } from '../api/client';
import { hasFreshSavedPretest } from './pretestFreshness';

export interface InternLearningStatus {
  pretestCompleted: boolean;
  pretestScore: AssessmentScore | null;
  activeCycleId: string | null;
  requiredModuleIds: string[];
  completedRequiredModuleIds: string[];
  requiredModulesCompleted: boolean;
  posttestCompleted: boolean;
  posttestScore: AssessmentScore | null;
  studioUnlocked: boolean;
}

// Required (review-recommended) modules for a graded pre-test: the frozen
// modules the learner did NOT ace. Single source of truth shared by the intern
// status snapshot and the cycle-scoped Post-Test eligibility gate, so the gate
// never drifts from a second definition of "required".
export function requiredModuleIdsFromPretestScore(preScore: AssessmentScore | null): string[] {
  if (!preScore) return [];
  return Object.values(preScore.byModule)
    .filter((row) => row.percent < REVIEW_REQUIRED_BELOW_PERCENT)
    .map((row) => row.moduleId);
}

function latestPretestCycleId(assessments: LearningAssessmentsResponse): string | null {
  const attempts = assessments.attempts
    .filter((attempt) => attempt.assessmentType === 'pretest')
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id - b.id);
  return attempts[attempts.length - 1]?.cycleId ?? null;
}

export function deriveInternLearningStatus(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
  progress: LearningProgress,
): InternLearningStatus {
  const pretestCompleted = hasFreshSavedPretest(assessments);
  const activeCycleId = latestPretestCycleId(assessments);
  const pretestScore = activeCycleId
    ? scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'pretest', activeCycleId)
    : scoreStoredObjectiveAssessment(modules, assessments, 'pretest');
  const requiredModuleIds = requiredModuleIdsFromPretestScore(pretestScore);
  const completedSet = new Set(progress.completedModuleIds);
  const completedRequiredModuleIds = requiredModuleIds.filter((moduleId) => completedSet.has(moduleId));
  const requiredModulesCompleted =
    pretestCompleted && completedRequiredModuleIds.length === requiredModuleIds.length;
  const posttestScore = activeCycleId
    ? scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'posttest', activeCycleId)
    : scoreStoredObjectiveAssessment(modules, assessments, 'posttest');
  const posttestCompleted = posttestScore !== null;

  return {
    pretestCompleted,
    pretestScore,
    activeCycleId,
    requiredModuleIds,
    completedRequiredModuleIds,
    requiredModulesCompleted,
    posttestCompleted,
    posttestScore,
    studioUnlocked: pretestCompleted && requiredModulesCompleted && posttestCompleted,
  };
}
