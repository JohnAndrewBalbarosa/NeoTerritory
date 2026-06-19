import { describe, it, expect } from 'vitest';
import { LEARNING_MODULES, normalizeLearningModules } from '../../../data/learningModules';
import type { LearningRawQuestionResult } from '../../../types/api';
import { deriveLearnerLearningRecord as _d, type RawAnswer, type RawAttempt, type RawLearnerRecord } from '../deriveLearnerLearningRecord';
import { deriveLearnerAnalytics, deriveModuleAnalytics, deriveQuestionAnalytics, summarizeInModuleAnalytics, MIN_SAMPLE_LEARNERS } from '../inModuleAnalytics';

void _d;
const MODULES = normalizeLearningModules(LEARNING_MODULES);
const byId = new Map(MODULES.map((m) => [m.id, m]));

// pretest answers that score 0% for a module (so it becomes recommended_to_study)
function failPre(attemptId: number, moduleId: string): RawAnswer[] {
  const items = byId.get(moduleId)?.assessmentForms?.A ?? [];
  return items.map((q, i) => ({ attemptId, assessmentType: 'pretest' as const, assessmentIndex: i, moduleId, questionIndex: i, questionId: q.id, selectedIndex: ((q.type === 'mcq' ? q.correctIndex : 0) + 1) % 4, responseText: null, questionKind: 'theoretical' as const }));
}
function intern(id: number, recommendedModules: string[]): RawLearnerRecord {
  const attempts: RawAttempt[] = [{ attemptId: id * 10 + 1, assessmentType: 'pretest', cycleId: `cyc-${id}`, planId: 'p', questionCount: 0, createdAt: '2026-01-01T00:00:00Z' }];
  const answers = recommendedModules.flatMap((m) => failPre(id * 10 + 1, m));
  return { internId: id, username: `intern${id}`, email: `i${id}@x.io`, attempts, answers, progress: null, activePlan: null, planModules: [] };
}
const qr = (userId: number, moduleId: string, questionIndex: number, attempts: number, firstAttemptCorrect: 0 | 1, isCorrect: 0 | 1): LearningRawQuestionResult =>
  ({ userId, moduleId, questionIndex, selectedIndex: 0, isCorrect, firstAttemptCorrect, attempts, updatedAt: '2026-01-03T00:00:00Z' });

const interns = [intern(1, ['behavioural-observer', 'behavioural-strategy']), intern(2, ['behavioural-observer'])];
const results: LearningRawQuestionResult[] = [
  qr(1, 'behavioural-observer', 0, 2, 0, 1), // retried, eventually correct
  qr(1, 'behavioural-observer', 1, 1, 1, 1), // first try
  qr(1, 'behavioural-strategy', 0, 3, 0, 0), // retried, still incorrect
  qr(2, 'behavioural-observer', 0, 1, 1, 1), // first try
];

describe('inModuleAnalytics (in-module process aggregation)', () => {
  it('aggregates conceptual attempts per learner and counts retried questions', () => {
    const rows = deriveLearnerAnalytics(interns, results, MODULES);
    const a = rows.find((r) => r.internId === 1)!;
    expect(a.conceptualAttempts).toBe(6); // 2 + 1 + 3
    expect(a.retriedQuestions).toBe(2);   // observer q0 (2) + strategy q0 (3)
    const b = rows.find((r) => r.internId === 2)!;
    expect(b.conceptualAttempts).toBe(1);
    expect(b.retriedQuestions).toBe(0);
  });

  it('shows No Activity (null avg), not 0%, for a learner with no attempts', () => {
    const rows = deriveLearnerAnalytics([intern(3, ['behavioural-observer'])], [], MODULES);
    expect(rows[0].conceptualAttempts).toBe(0);
    expect(rows[0].avgAttemptsPerStartedModule).toBeNull(); // not 0
    expect(rows[0].modulesStarted).toBe(0);
  });

  it('excludes formal pre/post answers from conceptual attempt counts', () => {
    // The pretest answers exist on the intern record, but conceptual attempts
    // come ONLY from question results — so the count is unchanged at 0 here.
    const rows = deriveLearnerAnalytics([intern(4, ['behavioural-observer'])], [], MODULES);
    expect(rows[0].conceptualAttempts).toBe(0);
  });

  it('aggregates module analytics (started/attempts/retries/most-attempts) and flags small samples', () => {
    const mods = deriveModuleAnalytics(interns, results, MODULES);
    const obs = mods.find((m) => m.moduleId === 'behavioural-observer')!;
    expect(obs.learnersStarted).toBe(2);
    expect(obs.conceptualAttempts).toBe(4); // 2+1 (intern1) + 1 (intern2)
    expect(obs.questionsWithRetries).toBe(1); // q0
    expect(obs.learnerWithMostAttempts).toBe('intern1');
    expect(obs.maxAttemptCount).toBe(3);
    const strat = mods.find((m) => m.moduleId === 'behavioural-strategy')!;
    expect(strat.learnersStarted).toBe(1);
    expect(strat.status).toBe('Limited Data'); // < MIN_SAMPLE_LEARNERS
    expect(MIN_SAMPLE_LEARNERS).toBe(2);
  });

  it('aggregates question analytics with separate first-attempt and eventual rates', () => {
    const qs = deriveQuestionAnalytics(results, MODULES);
    const obsQ0 = qs.find((q) => q.moduleId === 'behavioural-observer' && q.questionIndex === 0)!;
    expect(obsQ0.learnersAttempted).toBe(2);
    expect(obsQ0.totalAttempts).toBe(3); // 2 + 1
    expect(obsQ0.firstAttemptCorrectCount).toBe(1); // intern2 only
    expect(obsQ0.firstAttemptRate).toBe(50);
    expect(obsQ0.eventualCorrectCount).toBe(2); // both isCorrect
    expect(obsQ0.eventualRate).toBe(100);
    expect(obsQ0.retriedLearners).toBe(1); // intern1
  });

  it('does not fabricate rates for questions with no activity', () => {
    const qs = deriveQuestionAnalytics([], MODULES);
    expect(qs.length).toBe(0); // no rows fabricated when no attempts exist
  });

  it('summary separates conceptual attempts and practical submissions', () => {
    const s = summarizeInModuleAnalytics(interns, results, MODULES);
    expect(s.totalConceptualAttempts).toBe(7); // 6 (intern1) + 1 (intern2)
    expect(s.totalPracticalSubmissions).toBe(0); // no practical answers in fixtures
    expect(s.learnersWithRetries).toBe(1); // intern1
  });
});
