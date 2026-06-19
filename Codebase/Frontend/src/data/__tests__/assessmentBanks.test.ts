import { describe, expect, it } from 'vitest';
import {
  validateAllQuestionBanks,
  getFormalQuestionsForModule,
  getInModuleQuestionsForModule,
  getPracticalTaskForModule,
  getAssessmentCompetencyBlueprint,
  getFormalAssessmentInventory,
  collectReviewData,
} from '../assessmentBanks';

const AUTHORED = ['foundations-what-is-pattern', 'creational-builder', 'foundations-why-matters', 'foundations-categories', 'foundations-oop'];

describe('question-bank validators', () => {
  const report = validateAllQuestionBanks();

  it('has zero blocking ERROR findings', () => {
    expect(report.errors, JSON.stringify(report.errors, null, 2)).toHaveLength(0);
    expect(report.ok).toBe(true);
  });

  it('reports no duplicate IDs across all banks', () => {
    expect(report.errors.filter((e) => e.code === 'DUPLICATE_ID')).toHaveLength(0);
  });
});

describe('authored formal modules', () => {
  it.each(AUTHORED)('%s has Form A and Form B with equal, non-zero counts', (moduleId) => {
    const a = getFormalQuestionsForModule(moduleId, 'A');
    const b = getFormalQuestionsForModule(moduleId, 'B');
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);
  });

  it.each(AUTHORED)('%s formal items each have exactly 4 options + valid correctIndex', (moduleId) => {
    for (const q of [...getFormalQuestionsForModule(moduleId, 'A'), ...getFormalQuestionsForModule(moduleId, 'B')]) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  it.each(AUTHORED)('%s A/B pairs share Bloom level, have distinct prompts, and non-overlapping IDs', (moduleId) => {
    const a = getFormalQuestionsForModule(moduleId, 'A');
    const b = getFormalQuestionsForModule(moduleId, 'B');
    const bById = new Map(b.map((q) => [q.questionId, q]));
    const aIds = new Set(a.map((q) => q.questionId));
    expect(b.every((q) => !aIds.has(q.questionId))).toBe(true);
    for (const q of a) {
      const mate = q.pairedQuestionId ? bById.get(q.pairedQuestionId) : undefined;
      expect(mate, `pair for ${q.questionId}`).toBeTruthy();
      if (!mate) continue;
      expect(mate.bloomLevel).toBe(q.bloomLevel);
      expect(mate.prompt.trim().toLowerCase()).not.toBe(q.prompt.trim().toLowerCase());
    }
  });

  it('no formal item is tagged Create (Create is practical-only)', () => {
    for (const moduleId of AUTHORED) {
      for (const q of [...getFormalQuestionsForModule(moduleId, 'A'), ...getFormalQuestionsForModule(moduleId, 'B')]) {
        expect(q.bloomLevel).not.toBe('create');
      }
    }
  });
});

describe('Bloom blueprints', () => {
  it('Foundation modules are NOT forced to all six levels', () => {
    const bp = getAssessmentCompetencyBlueprint('foundations-what-is-pattern');
    expect(bp).toBeTruthy();
    expect(bp!.applicableObjectiveLevels).not.toContain('create');
    expect(bp!.requiresPracticalCreate).toBe(false);
    expect(bp!.nonApplicableLevels).toContain('create');
  });

  it('full design-pattern modules require a Create practical task and have one', () => {
    const bp = getAssessmentCompetencyBlueprint('creational-builder');
    expect(bp!.requiresPracticalCreate).toBe(true);
    const task = getPracticalTaskForModule('creational-builder');
    expect(task).toBeTruthy();
    expect(task!.bloomLevel).toBe('create');
  });
});

describe('in-module banks (regression)', () => {
  it('preserve original source question indexes (0..n-1 in order)', () => {
    const im = getInModuleQuestionsForModule('creational-builder');
    expect(im.length).toBeGreaterThan(0);
    im.forEach((q, i) => expect(q.sourceQuestionIndex).toBe(i));
  });
});

describe('review export data', () => {
  it('aggregates deterministic counts and passes validation', () => {
    const data = collectReviewData();
    expect(data.validation.errors).toHaveLength(0);
    expect(data.counts.formA).toBe(data.counts.formB); // forms balanced overall
    expect(data.counts.grandTotal).toBe(data.counts.formA + data.counts.formB + data.counts.inModule + data.counts.practical);
    expect(getFormalAssessmentInventory().length).toBe(data.counts.totalModules);
  });
});
