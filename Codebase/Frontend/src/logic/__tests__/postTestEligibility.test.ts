import { describe, it, expect } from 'vitest';
import { LEARNING_MODULES, normalizeLearningModules } from '../../data/learningModules';
import type {
  LearningAssessmentsResponse,
  LearningAssessmentAttemptRaw,
  LearningAssessmentAnswerRaw,
} from '../../types/api';
import { getPostTestEligibility, pairedLearningGain, resolvePostTestCycleId } from '../postTestEligibility';

const MODULES = normalizeLearningModules(LEARNING_MODULES);
const byId = new Map(MODULES.map((m) => [m.id, m]));

// Real modules that have BOTH a complete Form A and Form B.
const REQ1 = 'behavioural-strategy';
const REQ2 = 'creational-builder';
const OPT1 = 'creational-singleton';
const OPT2 = 'structural-adapter';

// Build graded answer rows for a module's form. correct=false flips the choice
// so the module scores 0% (→ required); correct=true scores 100% (→ optional).
function answersFor(
  attemptId: number,
  type: 'pretest' | 'posttest',
  form: 'A' | 'B',
  moduleId: string,
  correct: boolean,
): LearningAssessmentAnswerRaw[] {
  const items = byId.get(moduleId)?.assessmentForms?.[form] ?? [];
  return items.map((q, i) => {
    const correctIndex = q.type === 'mcq' ? q.correctIndex : 0;
    return {
      id: attemptId * 1000 + i,
      attemptId,
      assessmentType: type,
      assessmentIndex: i,
      moduleId,
      questionIndex: i,
      questionId: q.id,
      selectedIndex: correct ? correctIndex : (correctIndex + 1) % 4,
      responseText: null,
      questionTaxonomy: null,
      questionKind: 'theoretical' as const,
      sessionId: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
  });
}

interface CycleSpec {
  cycleId: string;
  attemptBase: number;
  createdAt?: string;
  pre: Array<{ moduleId: string; correct: boolean }>;
  post?: Array<{ moduleId: string; correct: boolean }>;
}

function buildAssessments(cycles: CycleSpec[]): LearningAssessmentsResponse {
  const attempts: LearningAssessmentAttemptRaw[] = [];
  const answers: LearningAssessmentAnswerRaw[] = [];
  for (const c of cycles) {
    const preId = c.attemptBase;
    attempts.push({ id: preId, assessmentType: 'pretest', sessionId: null, questionCount: c.pre.length * 5, cycleId: c.cycleId, planId: 'plan-1', createdAt: c.createdAt ?? '2026-01-01T00:00:00Z' });
    c.pre.forEach((m) => answers.push(...answersFor(preId, 'pretest', 'A', m.moduleId, m.correct)));
    if (c.post) {
      const postId = c.attemptBase + 1;
      attempts.push({ id: postId, assessmentType: 'posttest', sessionId: null, questionCount: c.post.length * 5, cycleId: c.cycleId, planId: 'plan-1', createdAt: c.createdAt ?? '2026-01-02T00:00:00Z' });
      c.post.forEach((m) => answers.push(...answersFor(postId, 'posttest', 'B', m.moduleId, m.correct)));
    }
  }
  return { attempts, answers };
}

const eligibility = (assessments: LearningAssessmentsResponse, cycleId: string | null, completedModuleIds: string[]) =>
  getPostTestEligibility({ modules: MODULES, assessments, progress: { completedModuleIds }, cycleId });

describe('getPostTestEligibility — release gate', () => {
  it('(1) is locked before the cycle’s Pre-Test is submitted', () => {
    const empty: LearningAssessmentsResponse = { attempts: [], answers: [] };
    const r = eligibility(empty, 'cyc-A', []);
    expect(r.eligible).toBe(false);
    expect(r.status).toBe('locked');
    expect(r.reasonCode).toBe('NO_PAIRED_PRETEST');
  });

  it('(2) stays locked while one required module is incomplete', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: REQ2, correct: false },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1]); // REQ2 still incomplete
    expect(r.status).toBe('locked');
    expect(r.reasonCode).toBe('MODULES_INCOMPLETE');
    expect(r.requiredModuleCount).toBe(2);
    expect(r.completedRequiredModuleCount).toBe(1);
    expect(r.remainingModuleIds).toEqual([REQ2]);
  });

  it('(3) unlocks once all required modules are complete', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: REQ2, correct: false },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1, REQ2]);
    expect(r.eligible).toBe(true);
    expect(r.status).toBe('available');
    expect(r.remainingModuleIds).toEqual([]);
  });

  it('(4) an incomplete optional module does NOT block release', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: OPT1, correct: true },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1]); // OPT1 never started
    expect(r.status).toBe('available');
    expect(r.requiredModuleCount).toBe(1);
    expect(r.remainingModuleIds).toEqual([]);
  });

  it('(5) a skipped optional module does NOT block release (optional excluded from denominator)', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: OPT1, correct: true },
    ] }]);
    // OPT1 is skipped (not in completed). It must not appear in remaining.
    const r = eligibility(a, 'cyc-A', [REQ1]);
    expect(r.status).toBe('available');
    expect(r.remainingModuleIds).not.toContain(OPT1);
  });

  it('(6) an unanswered optional conceptual assessment does NOT block release', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: OPT1, correct: true }, { moduleId: OPT2, correct: true },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1]); // optionals untouched
    expect(r.eligible).toBe(true);
    expect(r.requiredModuleCount).toBe(1);
  });

  it('(7) a required module still blocks release when incomplete', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: OPT1, correct: true },
    ] }]);
    const r = eligibility(a, 'cyc-A', []); // REQ1 not complete
    expect(r.status).toBe('locked');
    expect(r.remainingModuleIds).toEqual([REQ1]);
  });

  it('(8) covers the EXACT module set frozen by the paired Pre-Test', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: REQ2, correct: false }, { moduleId: OPT1, correct: true },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1, REQ2]);
    expect(r.frozenModuleIds.slice().sort()).toEqual([REQ1, REQ2, OPT1].sort());
    expect(r.coveredModuleCount).toBe(3);
  });

  it('(9) is NOT reduced to only the required modules (optional stays in coverage)', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: OPT1, correct: true },
    ] }]);
    const r = eligibility(a, 'cyc-A', [REQ1]);
    expect(r.frozenModuleIds).toContain(OPT1); // optional module still covered
    expect(r.requiredModuleCount).toBe(1);     // but not in the unlock gate
    expect(r.coveredModuleCount).toBe(2);
  });

  it('(10,11) two cycles stay independently paired — Cycle B does not unlock Cycle A', () => {
    const a = buildAssessments([
      { cycleId: 'cyc-A', attemptBase: 10, createdAt: '2026-01-01T00:00:00Z', pre: [
        { moduleId: REQ1, correct: false }, { moduleId: REQ2, correct: false },
      ] },
      { cycleId: 'cyc-B', attemptBase: 20, createdAt: '2026-02-01T00:00:00Z', pre: [
        { moduleId: OPT1, correct: false },
      ] },
    ]);
    // Cycle B's only required module (OPT1) is complete; Cycle A's are not.
    const rA = eligibility(a, 'cyc-A', [OPT1]);
    const rB = eligibility(a, 'cyc-B', [OPT1]);
    expect(rA.status).toBe('locked'); // A unaffected by B's completion
    expect(rA.remainingModuleIds.sort()).toEqual([REQ1, REQ2].sort());
    expect(rB.status).toBe('available');
  });

  it('(12) learning gain compares the Post-Test with the SAME cycle’s Pre-Test', () => {
    const a = buildAssessments([
      { cycleId: 'cyc-A', attemptBase: 10, pre: [{ moduleId: REQ1, correct: false }], post: [{ moduleId: REQ1, correct: true }] },
      { cycleId: 'cyc-B', attemptBase: 20, pre: [{ moduleId: REQ1, correct: true }] }, // high pre in another cycle
    ]);
    const gain = pairedLearningGain(MODULES, a, 'cyc-A');
    expect(gain).not.toBeNull();
    expect(gain!.pre.percent).toBe(0);   // cycle A pre, NOT cycle B
    expect(gain!.post.percent).toBe(100);
    expect(gain!.gain.gainPoints).toBe(100);
  });

  it('(16) a completed Post-Test is terminal and cannot be restarted', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [{ moduleId: REQ1, correct: false }], post: [{ moduleId: REQ1, correct: true }] }]);
    const r = eligibility(a, 'cyc-A', [REQ1]);
    expect(r.status).toBe('completed');
    expect(r.eligible).toBe(false); // no new attempt may be created
    expect(r.postTestAttemptId).not.toBeNull();
  });

  it('(17) a locked cycle is not eligible, so direct entry cannot build the Post-Test', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [
      { moduleId: REQ1, correct: false }, { moduleId: REQ2, correct: false },
    ] }]);
    const r = eligibility(a, 'cyc-A', []); // nothing completed
    expect(r.eligible).toBe(false);
    expect(r.status).toBe('locked');
  });

  it('(19) a frozen module missing Form B is a configuration issue, not a partial Post-Test', () => {
    // Synthetic module id NOT in the forms bank, so normalizeLearningModule keeps
    // its inline forms (complete Form A, EMPTY Form B). The pre-test grades on
    // Form A; the post-test cannot be built because Form B is absent.
    const SYNTH = 'synthetic-missing-b';
    const real = byId.get(REQ1)!;
    const synthModule = { ...real, id: SYNTH, title: 'Synthetic (no Form B)', assessmentForms: { A: real.assessmentForms!.A, B: [] } } as typeof real;
    const modulesWithSynth = [...MODULES, synthModule];

    const aItems = synthModule.assessmentForms!.A;
    const preAnswers: LearningAssessmentAnswerRaw[] = aItems.map((q, i) => ({
      id: 9000 + i, attemptId: 30, assessmentType: 'pretest', assessmentIndex: i, moduleId: SYNTH,
      questionIndex: i, questionId: q.id, selectedIndex: (q.type === 'mcq' ? q.correctIndex : 0 + 1) % 4,
      responseText: null, questionTaxonomy: null, questionKind: 'theoretical', sessionId: null, createdAt: '2026-01-01T00:00:00Z',
    }));
    const assessments: LearningAssessmentsResponse = {
      attempts: [{ id: 30, assessmentType: 'pretest', sessionId: null, questionCount: 5, cycleId: 'cyc-A', planId: 'plan-1', createdAt: '2026-01-01T00:00:00Z' }],
      answers: preAnswers,
    };
    const r = getPostTestEligibility({ modules: modulesWithSynth, assessments, progress: { completedModuleIds: [SYNTH] }, cycleId: 'cyc-A' });
    expect(r.status).toBe('config_issue');
    expect(r.reasonCode).toBe('INCOMPLETE_FORM_B');
    expect(r.missingFormBModuleIds).toContain(SYNTH);
    expect(r.eligible).toBe(false);
  });

  it('is idempotent — repeated evaluation yields the same result', () => {
    const a = buildAssessments([{ cycleId: 'cyc-A', attemptBase: 10, pre: [{ moduleId: REQ1, correct: false }] }]);
    const r1 = eligibility(a, 'cyc-A', [REQ1]);
    const r2 = eligibility(a, 'cyc-A', [REQ1]);
    expect(r2).toEqual(r1);
  });

  it('resolvePostTestCycleId returns the most recent pre-test cycle', () => {
    const a = buildAssessments([
      { cycleId: 'cyc-A', attemptBase: 10, createdAt: '2026-01-01T00:00:00Z', pre: [{ moduleId: REQ1, correct: false }] },
      { cycleId: 'cyc-B', attemptBase: 20, createdAt: '2026-03-01T00:00:00Z', pre: [{ moduleId: REQ2, correct: false }] },
    ]);
    expect(resolvePostTestCycleId(a)).toBe('cyc-B');
  });
});
