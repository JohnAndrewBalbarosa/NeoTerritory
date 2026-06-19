import { describe, it, expect } from 'vitest';
import { LEARNING_MODULES, normalizeLearningModules } from '../../../data/learningModules';
import { deriveLearnerLearningRecord, type RawAnswer, type RawAttempt, type RawLearnerRecord } from '../deriveLearnerLearningRecord';
import { summarizeOverview } from '../summarizeOverview';

const MODULES = normalizeLearningModules(LEARNING_MODULES);
const byId = new Map(MODULES.map((m) => [m.id, m]));

function answersFor(attemptId: number, type: 'pretest' | 'posttest', form: 'A' | 'B', moduleId: string, correct: boolean): RawAnswer[] {
  const items = byId.get(moduleId)?.assessmentForms?.[form] ?? [];
  return items.map((q, i) => {
    const ci = q.type === 'mcq' ? q.correctIndex : 0;
    return { attemptId, assessmentType: type, assessmentIndex: i, moduleId, questionIndex: i, questionId: q.id, selectedIndex: correct ? ci : (ci + 1) % 4, responseText: null, questionKind: 'theoretical' as const };
  });
}

// Build a learner record with a pre-test for the given modules + correctness.
function rec(internId: number, pre: Array<{ moduleId: string; correct: boolean }>, opts: { post?: Array<{ moduleId: string; correct: boolean }>; completed?: string[] } = {}): RawLearnerRecord {
  const attempts: RawAttempt[] = [{ attemptId: internId * 10 + 1, assessmentType: 'pretest', cycleId: `cyc-${internId}`, planId: 'p', questionCount: 0, createdAt: '2026-01-01T00:00:00Z' }];
  let answers = pre.flatMap((m) => answersFor(internId * 10 + 1, 'pretest', 'A', m.moduleId, m.correct));
  if (opts.post) {
    attempts.push({ attemptId: internId * 10 + 2, assessmentType: 'posttest', cycleId: `cyc-${internId}`, planId: 'p', questionCount: 0, createdAt: '2026-01-02T00:00:00Z' });
    answers = answers.concat(opts.post.flatMap((m) => answersFor(internId * 10 + 2, 'posttest', 'B', m.moduleId, m.correct)));
  }
  return { internId, username: `intern${internId}`, email: null, attempts, answers, progress: opts.completed ? { completedModuleIds: opts.completed } : null, activePlan: { id: 'p', projectSpecification: 'spec', status: 'active', activatedAt: null }, planModules: [] };
}

describe('summarizeOverview', () => {
  const A = deriveLearnerLearningRecord(rec(1, [{ moduleId: 'behavioural-observer', correct: false }, { moduleId: 'behavioural-strategy', correct: false }]), MODULES); // pre-test done, recommended not started
  const B = deriveLearnerLearningRecord(rec(2, [{ moduleId: 'behavioural-observer', correct: true }]), MODULES); // all understood → ready
  const C = deriveLearnerLearningRecord(rec(3, [{ moduleId: 'behavioural-observer', correct: true }], { post: [{ moduleId: 'behavioural-observer', correct: true }] }), MODULES); // post done
  const Empty = deriveLearnerLearningRecord({ internId: 4, username: 'd', attempts: [], answers: [], progress: null, activePlan: null, planModules: [] }, MODULES); // awaiting

  it('derives stage counts from real learner records', () => {
    const s = summarizeOverview([A, B, C, Empty], [A, B, C]);
    expect(s.activeInterns).toBe(4);
    expect(s.awaitingPreTest).toBe(1);
    expect(s.readyForPostTest).toBe(1); // B
    expect(s.stageCounts['Pre-Test Completed']).toBe(1); // A
    expect(s.stageCounts['Post-Test Completed']).toBe(1); // C
  });

  it('counts completed cycles from cycle records with a paired post-test', () => {
    const s = summarizeOverview([A, B, C], [A, B, C]);
    expect(s.completedLearningCycles).toBe(1); // only C has a post-test
  });

  it('computes recommended-module completion only over recommended modules', () => {
    const done = deriveLearnerLearningRecord(rec(5, [{ moduleId: 'behavioural-observer', correct: false }], { completed: ['behavioural-observer'] }), MODULES);
    const s = summarizeOverview([done], [done]);
    expect(s.avgRecommendedCompletionPct).toBe(100); // 1 recommended, 1 completed
  });

  it('flags incomplete recommended modules and repeated attempts in Needs Attention', () => {
    const s = summarizeOverview([A], [A], new Set([1]));
    const issues = s.needsAttention.map((n) => n.issue).join(' | ');
    expect(issues).toMatch(/none started|Incomplete recommended/i);
    expect(issues).toMatch(/Repeated in-module attempts/i);
  });

  it('does not fabricate metrics when there are no interns', () => {
    const s = summarizeOverview([], []);
    expect(s.activeInterns).toBe(0);
    expect(s.avgRecommendedPerIntern).toBe(0);
    expect(s.avgRecommendedCompletionPct).toBeNull(); // null, not a fabricated 0
    expect(s.completedLearningCycles).toBe(0);
  });
});
