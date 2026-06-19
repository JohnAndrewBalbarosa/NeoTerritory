import { describe, expect, it } from 'vitest';
import {
  approvedPlanModuleIds,
  pretestModuleSetForCycle,
  startPosttestForCycle,
  startPretestCycle,
  type LearningPlan,
} from '../assessmentCycle';
import { scoreStoredObjectiveAssessmentForCycle } from '../learningAssessments';
import { LEARNING_MODULES } from '../learningModules';
import type { LearningAssessmentAnswerRaw, LearningAssessmentAttemptRaw, LearningAssessmentsResponse } from '../../types/api';

const PILOT = ['foundations-what-is-pattern', 'creational-builder'];

function activePlan(modules: LearningPlan['modules']): LearningPlan {
  return { id: 'plan-1', status: 'active', modules };
}

function pretestAttempt(cycleId: string, id = 1): LearningAssessmentAttemptRaw {
  return { id, assessmentType: 'pretest', sessionId: 's', questionCount: 10, cycleId, planId: 'plan-1', createdAt: '2026-01-01T00:00:00Z' };
}

function answersForModules(attemptId: number, moduleIds: string[]): LearningAssessmentAnswerRaw[] {
  return moduleIds.map((moduleId, i) => ({
    id: attemptId * 100 + i,
    attemptId,
    assessmentType: 'pretest',
    assessmentIndex: i,
    moduleId,
    questionIndex: i,
    questionId: `${moduleId}:A${i + 1}`,
    selectedIndex: 0,
    responseText: null,
    questionTaxonomy: 'remembering',
    questionKind: 'theoretical',
    sessionId: 's',
    createdAt: '2026-01-01T00:00:00Z',
  }));
}

describe('assessment cycle — scope from active plan', () => {
  it('1. active plan with exactly two approved modules produces a 10-question Form A pre-test', () => {
    const plan = activePlan(PILOT.map((moduleId, i) => ({ moduleId, selectionStatus: 'approved' as const, displayOrder: i })));
    const result = startPretestCycle({ plan, modules: LEARNING_MODULES, cycleId: 'cyc-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(10);
    expect(new Set(result.questions.map((q) => q.moduleId))).toEqual(new Set(PILOT));
    expect(result.scope).toEqual(PILOT);
  });

  it('2. rejected / unapproved plan modules are excluded from scope', () => {
    const plan = activePlan([
      { moduleId: 'creational-builder', selectionStatus: 'approved', displayOrder: 0 },
      { moduleId: 'foundations-what-is-pattern', selectionStatus: 'rejected', displayOrder: 1 },
      { moduleId: 'creational-singleton', selectionStatus: 'recommended', displayOrder: 2 },
    ]);
    expect(approvedPlanModuleIds(plan)).toEqual(['creational-builder']);
    const result = startPretestCycle({ plan, modules: LEARNING_MODULES, cycleId: 'cyc-2' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.questions.map((q) => q.moduleId))).toEqual(new Set(['creational-builder']));
  });

  it('3. a missing active plan returns an explicit error and does NOT fall back', () => {
    expect(startPretestCycle({ plan: null, modules: LEARNING_MODULES, cycleId: 'c' })).toMatchObject({ ok: false, error: 'NO_ACTIVE_PLAN' });
    const draft = { id: 'p', status: 'draft', modules: PILOT.map((moduleId) => ({ moduleId, selectionStatus: 'approved' as const })) } as LearningPlan;
    expect(startPretestCycle({ plan: draft, modules: LEARNING_MODULES, cycleId: 'c' })).toMatchObject({ ok: false, error: 'NO_ACTIVE_PLAN' });
  });

  it('4. incomplete Form A returns an explicit configuration error', () => {
    const plan = activePlan([
      { moduleId: 'creational-builder', selectionStatus: 'approved', displayOrder: 0 },
      { moduleId: 'creational-singleton', selectionStatus: 'approved', displayOrder: 1 }, // no authored forms yet
    ]);
    const result = startPretestCycle({ plan, modules: LEARNING_MODULES, cycleId: 'cyc-4' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INCOMPLETE_FORM_A');
    expect(result.modules).toContain('creational-singleton');
  });
});

describe('assessment cycle — pre/post pairing', () => {
  const attempts = [pretestAttempt('cyc-10', 1)];
  const answers = answersForModules(1, PILOT);

  it('5. post-test uses the exact module IDs from its paired pre-test', () => {
    const result = startPosttestForCycle({ cycleId: 'cyc-10', modules: LEARNING_MODULES, attempts, answers });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.scope)).toEqual(new Set(PILOT));
    expect(result.questions).toHaveLength(10);
  });

  it('6. changing the active plan after the pre-test does NOT change the paired post-test scope', () => {
    // The post-test never takes a plan argument; scope comes only from the
    // frozen pre-test answers, so a plan change is irrelevant by construction.
    const result = startPosttestForCycle({ cycleId: 'cyc-10', modules: LEARNING_MODULES, attempts, answers });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.scope)).toEqual(new Set(PILOT));
  });

  it('7. a post-test cannot start without a completed pre-test in the same cycle', () => {
    expect(startPosttestForCycle({ cycleId: 'cyc-10', modules: LEARNING_MODULES, attempts: [], answers: [] }))
      .toMatchObject({ ok: false, error: 'NO_PAIRED_PRETEST' });
  });

  it('8. two different cycles do not pair with one another', () => {
    expect(startPosttestForCycle({ cycleId: 'cyc-OTHER', modules: LEARNING_MODULES, attempts, answers }))
      .toMatchObject({ ok: false, error: 'NO_PAIRED_PRETEST' });
    expect(pretestModuleSetForCycle('cyc-OTHER', attempts, answers)).toBeNull();
  });

  it('9. Form A and Form B question IDs have zero overlap', () => {
    const plan = activePlan(PILOT.map((moduleId, i) => ({ moduleId, selectionStatus: 'approved' as const, displayOrder: i })));
    const pre = startPretestCycle({ plan, modules: LEARNING_MODULES, cycleId: 'cyc-10' });
    const post = startPosttestForCycle({ cycleId: 'cyc-10', modules: LEARNING_MODULES, attempts, answers });
    expect(pre.ok && post.ok).toBe(true);
    if (!pre.ok || !post.ok) return;
    const aIds = new Set(pre.questions.map((q) => q.questionId));
    expect(post.questions.filter((q) => aIds.has(q.questionId))).toHaveLength(0);
  });
});

describe('assessment cycle — legacy compatibility', () => {
  it('10. legacy attempts with NULL cycle_id are not mis-paired by the cycle logic', () => {
    const legacy: LearningAssessmentAttemptRaw[] = [
      { id: 9, assessmentType: 'pretest', sessionId: null, questionCount: 5, cycleId: null, planId: null, createdAt: '2025-01-01T00:00:00Z' },
    ];
    expect(pretestModuleSetForCycle('any', legacy, answersForModules(9, PILOT))).toBeNull();
  });

  it('12. learning gain is scored against the SAME cycle\'s pre-test, not the latest', () => {
    // Builder Form A correct answers (from assessmentForms): A1=0,A2=2,A3=1,A4=3,A5=0.
    const builderA: Array<[number, number]> = [[0, 0], [1, 2], [2, 1], [3, 3], [4, 0]];
    function builderPretestAnswers(attemptId: number, allCorrect: boolean): LearningAssessmentAnswerRaw[] {
      return builderA.map(([qi, correct], i) => ({
        id: attemptId * 100 + i,
        attemptId,
        assessmentType: 'pretest',
        assessmentIndex: i,
        moduleId: 'creational-builder',
        questionIndex: qi,
        questionId: `creational-builder:A${qi + 1}`,
        selectedIndex: allCorrect ? correct : (correct + 1) % 4,
        responseText: null,
        questionTaxonomy: 'remembering',
        questionKind: 'theoretical',
        sessionId: 's',
        createdAt: attemptId === 1 ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z',
      }));
    }
    const attempts: LearningAssessmentAttemptRaw[] = [
      { id: 1, assessmentType: 'pretest', sessionId: 's', questionCount: 5, cycleId: 'cyc-A', planId: 'p', createdAt: '2026-01-01T00:00:00Z' }, // all correct
      { id: 2, assessmentType: 'pretest', sessionId: 's', questionCount: 5, cycleId: 'cyc-B', planId: 'p', createdAt: '2026-02-01T00:00:00Z' }, // later, all wrong
    ];
    const answers = [...builderPretestAnswers(1, true), ...builderPretestAnswers(2, false)];
    const data = { attempts, answers, courseUpdatedAt: undefined } as unknown as LearningAssessmentsResponse;

    const cycleA = scoreStoredObjectiveAssessmentForCycle(LEARNING_MODULES, data, 'pretest', 'cyc-A');
    const cycleB = scoreStoredObjectiveAssessmentForCycle(LEARNING_MODULES, data, 'pretest', 'cyc-B');
    expect(cycleA?.percent).toBe(100); // earlier cycle, all correct
    expect(cycleB?.percent).toBe(0); // latest cycle, all wrong — NOT used for cycle-A gain
  });

  it('11. an active plan with no approved/added modules is an explicit error (no fallback)', () => {
    const plan = activePlan([
      { moduleId: 'creational-builder', selectionStatus: 'recommended' },
      { moduleId: 'foundations-what-is-pattern', selectionStatus: 'rejected' },
    ]);
    expect(startPretestCycle({ plan, modules: LEARNING_MODULES, cycleId: 'c' })).toMatchObject({ ok: false, error: 'NO_APPROVED_MODULES' });
  });
});
