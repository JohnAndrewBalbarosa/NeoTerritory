import { describe, it, expect } from 'vitest';
import { LEARNING_MODULES, normalizeLearningModules } from '../../../data/learningModules';
import { deriveLearnerLearningRecord, type RawAnswer, type RawAttempt, type RawLearnerRecord } from '../deriveLearnerLearningRecord';

const MODULES = normalizeLearningModules(LEARNING_MODULES);
const byId = new Map(MODULES.map((m) => [m.id, m]));

// Build raw answers for a module's Form A/B using the bank's real correctIndex,
// so "correct" reflects the authoritative grader (no hard-coded answer keys).
function answersFor(attemptId: number, type: 'pretest' | 'posttest', form: 'A' | 'B', moduleId: string, correct: boolean): RawAnswer[] {
  const items = byId.get(moduleId)?.assessmentForms?.[form] ?? [];
  return items.map((q, i) => {
    const correctIndex = q.type === 'mcq' ? q.correctIndex : 0;
    return {
      attemptId,
      assessmentType: type,
      assessmentIndex: i,
      moduleId,
      questionIndex: i,
      questionId: q.id,
      selectedIndex: correct ? correctIndex : (correctIndex + 1) % 4,
      responseText: null,
      questionKind: 'theoretical' as const,
    };
  });
}

function record(opts: {
  pre: Array<{ moduleId: string; correct: boolean }>;
  post?: Array<{ moduleId: string; correct: boolean }>;
  completed?: string[];
}): RawLearnerRecord {
  const attempts: RawAttempt[] = [{ attemptId: 1, assessmentType: 'pretest', cycleId: 'cyc-1', planId: 'plan-1', questionCount: 0, createdAt: '2026-01-01T00:00:00Z' }];
  let answers: RawAnswer[] = opts.pre.flatMap((m) => answersFor(1, 'pretest', 'A', m.moduleId, m.correct));
  if (opts.post) {
    attempts.push({ attemptId: 2, assessmentType: 'posttest', cycleId: 'cyc-1', planId: 'plan-1', questionCount: 0, createdAt: '2026-01-02T00:00:00Z' });
    answers = answers.concat(opts.post.flatMap((m) => answersFor(2, 'posttest', 'B', m.moduleId, m.correct)));
  }
  return {
    internId: 1, username: 'intern1', email: null,
    attempts, answers,
    progress: opts.completed ? { completedModuleIds: opts.completed } : null,
    activePlan: { id: 'plan-1', projectSpecification: 'spec', status: 'active', activatedAt: null },
    planModules: opts.pre.map((m, i) => ({ moduleId: m.moduleId, selectionStatus: 'approved', recommendationSource: 'ai', displayOrder: i })),
  };
}

describe('deriveLearnerLearningRecord', () => {
  it('classifies a below-threshold module as recommended_to_study and an at/above one as already_understood', () => {
    const rec = deriveLearnerLearningRecord(record({ pre: [
      { moduleId: 'behavioural-observer', correct: true },  // 100% → already understood
      { moduleId: 'behavioural-strategy', correct: false },  // 0% → recommended
    ] }), MODULES);
    expect(rec.recommendedToStudy.map((r) => r.moduleId)).toEqual(['behavioural-strategy']);
    expect(rec.alreadyUnderstood.map((r) => r.moduleId)).toEqual(['behavioural-observer']);
    expect(rec.recommendedToStudy[0].recommendationReason).toMatch(/did not meet the 80% proficiency threshold/);
    expect(rec.alreadyUnderstood[0].recommendationReason).toMatch(/met the existing 80% proficiency threshold/);
  });

  it('uses the same cycle pre/post and reports a correct percentage-point difference', () => {
    const rec = deriveLearnerLearningRecord(record({
      pre: [{ moduleId: 'behavioural-observer', correct: true }, { moduleId: 'behavioural-strategy', correct: false }], // pre 50%
      post: [{ moduleId: 'behavioural-observer', correct: true }, { moduleId: 'behavioural-strategy', correct: true }], // post 100%
    }), MODULES);
    expect(rec.prePercent).toBe(50);
    expect(rec.postPercent).toBe(100);
    expect(rec.ppDiff).toBe(50);
    expect(rec.hasPostTest).toBe(true);
  });

  it('derives different recommendations for two learners with the same project modules', () => {
    const weak = deriveLearnerLearningRecord(record({ pre: [{ moduleId: 'behavioural-observer', correct: false }, { moduleId: 'behavioural-strategy', correct: false }] }), MODULES);
    const strong = deriveLearnerLearningRecord(record({ pre: [{ moduleId: 'behavioural-observer', correct: true }, { moduleId: 'behavioural-strategy', correct: true }] }), MODULES);
    expect(weak.recommendedToStudy.length).toBe(2);
    expect(strong.recommendedToStudy.length).toBe(0);
    expect(strong.alreadyUnderstood.length).toBe(2);
  });

  it('derives the stage from real records (awaiting → pre-test completed → ready)', () => {
    const noPre = deriveLearnerLearningRecord({ internId: 1, username: 'x', attempts: [], answers: [], progress: null, activePlan: null, planModules: [] }, MODULES);
    expect(noPre.stage).toBe('Awaiting Pre-Test');

    const preOnly = deriveLearnerLearningRecord(record({ pre: [{ moduleId: 'behavioural-strategy', correct: false }] }), MODULES);
    expect(preOnly.stage).toBe('Pre-Test Completed'); // recommended module not started

    const allUnderstood = deriveLearnerLearningRecord(record({ pre: [{ moduleId: 'behavioural-observer', correct: true }] }), MODULES);
    expect(allUnderstood.stage).toBe('Ready for Post-Test'); // nothing to study

    const done = deriveLearnerLearningRecord(record({
      pre: [{ moduleId: 'behavioural-observer', correct: true }],
      post: [{ moduleId: 'behavioural-observer', correct: true }],
    }), MODULES);
    expect(done.stage).toBe('Post-Test Completed');
  });

  it('keeps the project-relevant scope frozen to the pre-test answers (cycle-isolated, not global toggles)', () => {
    const rec = deriveLearnerLearningRecord(record({ pre: [{ moduleId: 'behavioural-observer', correct: true }, { moduleId: 'behavioural-strategy', correct: false }] }), MODULES);
    // Scope comes from the cycle's pre-test answers, independent of any current
    // course-plan toggle state.
    expect(new Set(rec.projectRelevantModuleIds)).toEqual(new Set(['behavioural-observer', 'behavioural-strategy']));
    expect(rec.cycleId).toBe('cyc-1');
  });

  it('keeps conceptual and practical statuses separate per module', () => {
    const rec = deriveLearnerLearningRecord(record({
      pre: [{ moduleId: 'behavioural-strategy', correct: false }],
      completed: ['behavioural-strategy'],
    }), MODULES);
    const m = rec.recommendations.find((r) => r.moduleId === 'behavioural-strategy')!;
    expect(m.conceptualStatus).toBe('Passed');
    // strategy has a practical exam → tracked separately, and completion is NOT
    // labeled as a formal practical grade ('Completed', never 'Passed').
    expect(m.practicalStatus).toBe('Completed');
  });
});
