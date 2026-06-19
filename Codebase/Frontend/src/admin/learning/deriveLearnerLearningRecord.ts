// Shared PM learning-record derivation. The backend stores RAW attempts/answers
// only; this module re-grades them with the SAME authoritative helpers the
// learner flow uses (scoreStoredObjectiveAssessmentForCycle / computeLearningGain
// / moduleProficiencyStatus / PROFICIENCY_THRESHOLD) so PM views never duplicate
// grading logic and never invent a second threshold.
//
// Historical safety: scoring + recommendations are derived from the FROZEN
// per-cycle records (the pre-test attempt's stored answers + its frozen module
// set), never from the current global course-plan toggles — so a past cycle's
// recommendations stay stable when toggles change later.

import {
  scoreStoredObjectiveAssessmentForCycle,
  moduleProficiencyStatus,
  PROFICIENCY_THRESHOLD,
  type AssessmentScore,
} from '../../data/learningAssessments';
import type { LearningModule } from '../../data/learningModules';
import type {
  LearningAssessmentsResponse,
  LearningAssessmentAttemptRaw,
  LearningAssessmentAnswerRaw,
  LearningAssessmentType,
} from '../../types/api';

// ---- Raw shapes returned by GET /api/admin/learning/interns(/:id) ----
export interface RawAttempt {
  attemptId: number;
  assessmentType: LearningAssessmentType;
  cycleId?: string | null;
  planId?: string | null;
  questionCount: number;
  createdAt: string;
}
export interface RawAnswer {
  attemptId: number;
  assessmentType: LearningAssessmentType;
  assessmentIndex: number;
  moduleId: string;
  questionIndex: number;
  questionId?: string | null;
  selectedIndex: number;
  responseText: string | null;
  questionKind: 'theoretical' | 'practical';
}
export interface RawProgress {
  completedModuleIds?: string | string[] | null;
  theoryPassedModuleIds?: string | string[] | null;
  // Explicit learner "skip" decisions for optional (already-understood) modules.
  // This is the only optional-review state that is not reconstructable from
  // pre-test scores or completion.
  skippedModuleIds?: string | string[] | null;
  updatedAt?: string | null;
}
export interface RawActivePlan {
  id: string;
  projectSpecification: string | null;
  status: string;
  activatedAt: string | null;
}
export interface RawPlanModule {
  moduleId: string;
  selectionStatus: string;
  recommendationSource: string;
  displayOrder: number | null;
}
export interface RawLearnerRecord {
  internId: number;
  username: string;
  email?: string | null;
  attempts: RawAttempt[];
  answers: RawAnswer[];
  progress: RawProgress | null;
  activePlan: RawActivePlan | null;
  planModules: RawPlanModule[];
}

export type LearnerStage =
  | 'Awaiting Pre-Test'
  | 'Pre-Test Completed'
  | 'Learning in Progress'
  | 'Ready for Post-Test'
  | 'Post-Test Completed'
  | 'Needs Review';

export type RecommendationLabel = 'recommended_to_study' | 'already_understood' | 'optional_review';

export interface LearnerModuleRecommendation {
  cycleId: string;
  internId: number;
  moduleId: string;
  moduleTitle: string;
  category: string;
  includedInPreTest: boolean;
  preTestRawScore: number | null;
  preTestPercentage: number | null;
  recommendation: RecommendationLabel;
  recommendationReason: string;
  // Required vs Optional Review (after the pre-test). Below the proficiency
  // threshold → 'required'; at/above → 'optional' (Already Understood). Optional
  // modules never block required progression and are excluded from required
  // progress. Derived from the same threshold/recommendation logic — no 2nd rule.
  requirement: 'required' | 'optional';
  assigned: boolean;
  skipped: boolean;
  // True only when the learner explicitly dismissed this optional module
  // (persisted skip). Distinct from `skipped` (= classified already-understood).
  learnerSkipped: boolean;
  // Human-readable learner action, using accurate non-judgemental labels. Never
  // "Failed"/"Incomplete"/"Missing" for optional modules.
  learnerAction: string;
  progressPercent: number;
  conceptualStatus: string;
  practicalStatus: string;
  postTestRawScore: number | null;
  postTestPercentage: number | null;
  finalStatus: string;
}

export interface LearnerLearningRecord {
  internId: number;
  displayName: string;
  email: string | null;
  activePlan: RawActivePlan | null;
  cycleId: string | null;
  hasPreTest: boolean;
  hasPostTest: boolean;
  stage: LearnerStage;
  preScore: AssessmentScore | null;
  postScore: AssessmentScore | null;
  prePercent: number | null;
  postPercent: number | null;
  ppDiff: number | null; // percentage-point difference (post - pre), same cycle
  projectRelevantModuleIds: string[];
  recommendations: LearnerModuleRecommendation[];
  recommendedToStudy: LearnerModuleRecommendation[];
  alreadyUnderstood: LearnerModuleRecommendation[];
  completedRecommendedCount: number;
  // Required-only progress (optional/already-understood modules are excluded
  // from the denominator). 100 when there are no required modules so a fully
  // already-understood learner is eligible to proceed (not "0 of N").
  requiredModuleCount: number;
  completedRequiredCount: number;
  requiredProgressPercent: number;
  conceptualStatusOverall: string;
  practicalStatusOverall: string;
  interpretation: string;
  suggestedAction: string;
}

function parseIdList(v: string | string[] | null | undefined): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Adapt the admin raw attempts/answers into the LearningAssessmentsResponse shape
// the existing graders consume (attempt.attemptId → id; answers keep attemptId).
function toAssessmentsResponse(rec: RawLearnerRecord): LearningAssessmentsResponse {
  const attempts: LearningAssessmentAttemptRaw[] = rec.attempts.map((a) => ({
    id: a.attemptId,
    assessmentType: a.assessmentType,
    sessionId: null,
    questionCount: a.questionCount,
    cycleId: a.cycleId ?? null,
    planId: a.planId ?? null,
    createdAt: a.createdAt,
  }));
  const answers: LearningAssessmentAnswerRaw[] = rec.answers.map((a, i) => ({
    id: i,
    attemptId: a.attemptId,
    assessmentType: a.assessmentType,
    assessmentIndex: a.assessmentIndex,
    moduleId: a.moduleId,
    questionIndex: a.questionIndex,
    questionId: a.questionId ?? null,
    selectedIndex: a.selectedIndex,
    responseText: a.responseText,
    questionTaxonomy: null,
    questionKind: a.questionKind,
    sessionId: null,
    createdAt: '',
  }));
  return { attempts, answers };
}

// The active cycle = the most recent pre-test attempt's cycle_id.
function latestPretestCycleId(rec: RawLearnerRecord): string | null {
  const pres = rec.attempts
    .filter((a) => a.assessmentType === 'pretest' && a.cycleId)
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  return pres[0]?.cycleId ?? null;
}

function deriveStage(opts: {
  hasPreTest: boolean;
  hasPostTest: boolean;
  recommendedCount: number;
  completedRecommendedCount: number;
  ppDiff: number | null;
}): LearnerStage {
  const { hasPreTest, hasPostTest, recommendedCount, completedRecommendedCount, ppDiff } = opts;
  // Deterministic priority (documented):
  // 1. no pre-test → Awaiting Pre-Test
  if (!hasPreTest) return 'Awaiting Pre-Test';
  // 5/6. post-test exists → Post-Test Completed, or Needs Review if the learner
  //      regressed in the paired post-test.
  if (hasPostTest) return ppDiff !== null && ppDiff < 0 ? 'Needs Review' : 'Post-Test Completed';
  // No post-test yet:
  // - nothing recommended (all already understood) → Ready for Post-Test
  if (recommendedCount === 0) return 'Ready for Post-Test';
  // 2. recommended modules not started → Pre-Test Completed
  if (completedRecommendedCount === 0) return 'Pre-Test Completed';
  // 4. all recommended modules complete → Ready for Post-Test
  if (completedRecommendedCount >= recommendedCount) return 'Ready for Post-Test';
  // 3. some recommended modules still incomplete → Learning in Progress
  return 'Learning in Progress';
}

// Distinct pre-test cycle ids for a learner, newest first (each is a learning
// cycle that can be derived + monitored independently).
export function listLearnerCycles(rec: RawLearnerRecord): string[] {
  const seen = new Set<string>();
  return rec.attempts
    .filter((a) => a.assessmentType === 'pretest' && a.cycleId)
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    .map((a) => a.cycleId as string)
    .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

export function deriveLearnerLearningRecord(
  rec: RawLearnerRecord,
  modules: ReadonlyArray<LearningModule>,
  targetCycleId?: string, // when omitted, the most recent pre-test cycle is used
): LearnerLearningRecord {
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const assessments = toAssessmentsResponse(rec);
  // Cycle isolation: scoring/recommendations come from THIS cycle's frozen
  // pre-test answers only — never a different cycle and never current toggles.
  const cycleId = targetCycleId ?? latestPretestCycleId(rec);
  const completed = new Set(parseIdList(rec.progress?.completedModuleIds));
  const theoryPassed = new Set(parseIdList(rec.progress?.theoryPassedModuleIds));
  const skippedByLearner = new Set(parseIdList(rec.progress?.skippedModuleIds));

  const preScore = cycleId ? scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'pretest', cycleId) : null;
  const postScore = cycleId ? scoreStoredObjectiveAssessmentForCycle(modules, assessments, 'posttest', cycleId) : null;
  const hasPreTest = preScore !== null;
  const hasPostTest = postScore !== null;
  const ppDiff = preScore && postScore ? postScore.percent - preScore.percent : null;

  // Project-relevant (frozen) module set: the modules actually answered in the
  // cycle's pre-test (frozen scope). Falls back to the active plan's approved
  // modules when no pre-test has been taken yet.
  let projectRelevantModuleIds: string[];
  if (preScore) {
    projectRelevantModuleIds = Object.keys(preScore.byModule);
  } else {
    projectRelevantModuleIds = rec.planModules
      .filter((m) => m.selectionStatus === 'approved' || m.selectionStatus === 'added')
      .map((m) => m.moduleId);
  }

  const recommendations: LearnerModuleRecommendation[] = projectRelevantModuleIds.map((moduleId) => {
    const module = moduleById.get(moduleId);
    const preMod = preScore?.byModule[moduleId] ?? null;
    const postMod = postScore?.byModule[moduleId] ?? null;
    const prePercentage = preMod?.percent ?? null;
    const status = prePercentage === null ? 'recommended' : moduleProficiencyStatus(prePercentage);
    const recommendation: RecommendationLabel = status === 'proficient' ? 'already_understood' : 'recommended_to_study';
    const recommendationReason =
      recommendation === 'already_understood'
        ? `Pre-test result met the existing ${PROFICIENCY_THRESHOLD}% proficiency threshold.`
        : `Pre-test result did not meet the ${PROFICIENCY_THRESHOLD}% proficiency threshold.`;
    const isCompleted = completed.has(moduleId);
    const conceptualStatus = theoryPassed.has(moduleId) ? 'Passed' : isCompleted ? 'Passed' : 'Not started';
    // No formal practical GRADE is stored — module completion is only a proxy.
    // Use accurate, non-grade wording ('Completed'), never 'Passed'.
    const hasPractical = !!module?.practicalExam;
    const practicalStatus = !hasPractical ? 'Not applicable' : isCompleted ? 'Completed' : 'Not submitted';
    const progressPercent = isCompleted ? 100 : theoryPassed.has(moduleId) ? 50 : 0;
    const learnerSkipped = skippedByLearner.has(moduleId);
    const hasActivity = isCompleted || theoryPassed.has(moduleId);
    // Learner Action — accurate labels per requirement. Optional modules never
    // use "Failed"/"Incomplete"/"Missing"; an unanswered optional module is
    // simply "Optional — Not Reviewed", never a deficiency.
    let learnerAction: string;
    if (recommendation === 'recommended_to_study') {
      learnerAction = isCompleted ? 'Required Module Completed' : hasActivity ? 'In Progress' : 'Not Started';
    } else if (learnerSkipped) {
      learnerAction = 'Skipped — Already Understood';
    } else if (isCompleted) {
      learnerAction = 'Optional Assessment Completed';
    } else if (theoryPassed.has(moduleId)) {
      learnerAction = 'Optional Review Started';
    } else {
      learnerAction = 'Optional — Not Reviewed';
    }
    return {
      cycleId: cycleId ?? '',
      internId: rec.internId,
      moduleId,
      moduleTitle: module?.title ?? preMod?.moduleTitle ?? moduleId,
      category: module?.category ?? 'unknown',
      includedInPreTest: !!preMod,
      preTestRawScore: preMod ? preMod.correct : null,
      preTestPercentage: prePercentage,
      recommendation,
      recommendationReason,
      requirement: recommendation === 'recommended_to_study' ? 'required' : 'optional',
      assigned: recommendation === 'recommended_to_study',
      skipped: recommendation === 'already_understood',
      learnerSkipped,
      learnerAction,
      progressPercent,
      conceptualStatus,
      practicalStatus,
      postTestRawScore: postMod ? postMod.correct : null,
      postTestPercentage: postMod?.percent ?? null,
      finalStatus: isCompleted ? 'Completed' : recommendation === 'already_understood' ? 'Already Understood' : 'In Progress',
    };
  });

  const recommendedToStudy = recommendations.filter((r) => r.recommendation === 'recommended_to_study');
  const alreadyUnderstood = recommendations.filter((r) => r.recommendation === 'already_understood');
  const completedRecommendedCount = recommendedToStudy.filter((r) => r.progressPercent >= 100).length;
  // Required-only progress: optional (already-understood) modules are NOT in the
  // denominator. No required modules → 100% (eligible to proceed, not "0 of N").
  const requiredModuleCount = recommendedToStudy.length;
  const completedRequiredCount = completedRecommendedCount;
  const requiredProgressPercent = requiredModuleCount === 0 ? 100 : Math.round((completedRequiredCount / requiredModuleCount) * 100);

  const stage = deriveStage({
    hasPreTest,
    hasPostTest,
    recommendedCount: recommendedToStudy.length,
    completedRecommendedCount,
    ppDiff,
  });

  const conceptualStatusOverall = recommendedToStudy.length === 0
    ? 'No modules require study'
    : recommendedToStudy.every((r) => r.conceptualStatus === 'Passed')
      ? 'Complete'
      : recommendedToStudy.some((r) => r.conceptualStatus === 'Passed')
        ? 'In progress'
        : 'Not started';
  const practicalNeeded = recommendedToStudy.filter((r) => r.practicalStatus !== 'Not applicable');
  const practicalStatusOverall = practicalNeeded.length === 0
    ? 'Not applicable'
    : practicalNeeded.every((r) => r.practicalStatus === 'Completed')
      ? 'Complete'
      : practicalNeeded.some((r) => r.practicalStatus === 'Completed')
        ? 'In progress'
        : 'Pending';

  const interpretation = buildInterpretation({
    stage, recommendedToStudy, alreadyUnderstood, projectRelevantCount: projectRelevantModuleIds.length, ppDiff, practicalStatusOverall,
  });
  const suggestedAction = buildSuggestedAction({ stage, ppDiff, practicalStatusOverall });

  return {
    internId: rec.internId,
    displayName: rec.username,
    email: rec.email ?? null,
    activePlan: rec.activePlan,
    cycleId,
    hasPreTest,
    hasPostTest,
    stage,
    preScore,
    postScore,
    prePercent: preScore?.percent ?? null,
    postPercent: postScore?.percent ?? null,
    ppDiff,
    projectRelevantModuleIds,
    recommendations,
    recommendedToStudy,
    alreadyUnderstood,
    completedRecommendedCount,
    requiredModuleCount,
    completedRequiredCount,
    requiredProgressPercent,
    conceptualStatusOverall,
    practicalStatusOverall,
    interpretation,
    suggestedAction,
  };
}

function buildInterpretation(opts: {
  stage: LearnerStage;
  recommendedToStudy: LearnerModuleRecommendation[];
  alreadyUnderstood: LearnerModuleRecommendation[];
  projectRelevantCount: number;
  ppDiff: number | null;
  practicalStatusOverall: string;
}): string {
  const { stage, recommendedToStudy, alreadyUnderstood, projectRelevantCount, ppDiff, practicalStatusOverall } = opts;
  if (stage === 'Awaiting Pre-Test') return 'The learner has not taken the targeted pre-test yet.';
  const parts: string[] = [];
  parts.push(`Met the proficiency threshold in ${alreadyUnderstood.length} of ${projectRelevantCount} project-relevant module(s).`);
  if (recommendedToStudy.length) {
    const names = recommendedToStudy.slice(0, 4).map((r) => r.moduleTitle).join(', ');
    parts.push(`Recommended to study: ${names}${recommendedToStudy.length > 4 ? '…' : ''}.`);
  }
  if (ppDiff !== null) {
    parts.push(ppDiff >= 0
      ? `Improved by ${ppDiff} percentage point(s) in the paired post-test.`
      : `Regressed by ${Math.abs(ppDiff)} percentage point(s) in the paired post-test.`);
  }
  if (practicalStatusOverall === 'Pending' || practicalStatusOverall === 'In progress') {
    parts.push('A practical assessment still requires completion.');
  }
  return parts.join(' ');
}

function buildSuggestedAction(opts: { stage: LearnerStage; ppDiff: number | null; practicalStatusOverall: string }): string {
  const { stage, ppDiff, practicalStatusOverall } = opts;
  switch (stage) {
    case 'Awaiting Pre-Test': return 'Require PM Review';
    case 'Pre-Test Completed': return 'Proceed with Guidance';
    case 'Learning in Progress': return practicalStatusOverall === 'Pending' ? 'Assign Additional Review' : 'Proceed with Guidance';
    case 'Ready for Post-Test': return 'Allow to Proceed';
    case 'Post-Test Completed': return ppDiff !== null && ppDiff > 0 ? 'Allow to Proceed' : 'Proceed with Guidance';
    case 'Needs Review': return 'Require PM Review';
    default: return 'Proceed with Guidance';
  }
}
