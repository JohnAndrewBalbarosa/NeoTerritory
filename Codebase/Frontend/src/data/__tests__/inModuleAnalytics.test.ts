import { describe, it, expect } from 'vitest';
import { LEARNING_MODULES, normalizeLearningModules, BLOOM_TAXONOMIES, type LearningModule } from '../learningModules';
import { visibleTheoryQuestionIndexesFor } from '../../components/marketing/patterns/PatternsLearnPage';
import { getInModuleQuestionsForModule } from '../assessmentBanks/inventory';
import { IN_MODULE_THEORY } from '../assessmentBanks/inModule';

const MODULES = normalizeLearningModules(LEARNING_MODULES);
const byId = new Map(MODULES.map((m) => [m.id, m]));
const withTheory = MODULES.filter((m) => (m.theoreticalExam?.questions.length ?? 0) > 0);

// These tests pin the in-module analytics contract: the positional
// sourceQuestionIndex (the analytics key) and its fixed Bloom meaning must NOT
// change when conceptual content is authored.
describe('in-module analytics preservation', () => {
  it('1. every module has exactly 6 theory positions with the FIXED index→Bloom mapping', () => {
    for (const m of withTheory) {
      const qs = m.theoreticalExam!.questions;
      expect(qs.length).toBe(6);
      qs.forEach((q, i) => expect(q.taxonomy).toBe(BLOOM_TAXONOMIES[i]));
    }
  });

  it('2. sourceQuestionIndex equals array position and is unique within a module', () => {
    for (const m of withTheory) {
      const items = getInModuleQuestionsForModule(m.id);
      items.forEach((q, i) => expect(q.sourceQuestionIndex).toBe(i));
      expect(new Set(items.map((q) => q.sourceQuestionIndex)).size).toBe(items.length);
    }
  });

  it('3. visibleTheoryQuestionIndexesFor returns exactly the applicable (non-fallback) indexes', () => {
    for (const m of withTheory) {
      const expected = m.theoreticalExam!.questions
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => !q.generatedFallback)
        .map(({ i }) => i);
      expect(visibleTheoryQuestionIndexesFor(m, 0)).toEqual(expected);
    }
  });

  it('4. non-applicable Foundation Bloom levels are hidden (index preserved)', () => {
    // why-matters: only Remember + Understand applicable.
    expect(visibleTheoryQuestionIndexesFor(byId.get('foundations-why-matters'), 0)).toEqual([0, 1]);
    // ambiguity: Remember..Evaluate applicable (Create hidden).
    expect(visibleTheoryQuestionIndexesFor(byId.get('foundations-ambiguity'), 0)).toEqual([0, 1, 2, 3, 4]);
    // same-structure: Remember, Understand, Analyze applicable.
    expect(visibleTheoryQuestionIndexesFor(byId.get('foundations-same-structure'), 0)).toEqual([0, 1, 3]);
  });

  it('5. the Create position (index 5) is never an applicable/visible MCQ', () => {
    for (const m of withTheory) {
      const create = getInModuleQuestionsForModule(m.id)[5];
      expect(create.applicable).toBe(false);
      expect(visibleTheoryQuestionIndexesFor(m, 0)).not.toContain(5);
    }
  });

  it('6. authored applicable items carry full draft metadata and are valid MCQs', () => {
    for (const moduleId of Object.keys(IN_MODULE_THEORY)) {
      const items = getInModuleQuestionsForModule(moduleId).filter((q) => q.applicable);
      expect(items.length).toBeGreaterThan(0);
      for (const q of items) {
        expect(q.type).toBe('mcq');
        expect(q.options.length).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThanOrEqual(3);
        expect(q.competencyId && q.competencyId.length).toBeTruthy();
        expect(q.rationale && q.rationale.length).toBeTruthy();
        expect((q.sourceReferences ?? []).length).toBeGreaterThan(0);
        expect(q.validationStatus).toBe('draft');
        expect(q.bloomLevel).not.toBe('create');
      }
    }
  });

  it('7. Create-level practical preservation: pattern modules keep practicalExam; Repository has none', () => {
    expect(byId.get('idioms-pimpl')?.practicalExam).toBeTruthy();
    expect(byId.get('creational-prototype')?.practicalExam).toBeTruthy();
    expect(byId.get('behavioural-visitor')?.practicalExam).toBeTruthy();
    expect(byId.get('structural-repository')?.practicalExam).toBeFalsy();
  });

  it('8. formal Form A/B banks are unaffected by in-module authoring', () => {
    const check = (m: LearningModule | undefined) => {
      expect(m?.assessmentForms?.A.length).toBe(5);
      expect(m?.assessmentForms?.B.length).toBe(5);
    };
    check(byId.get('creational-singleton'));
    check(byId.get('behavioural-strategy'));
  });
});
