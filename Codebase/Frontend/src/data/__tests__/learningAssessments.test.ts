import { describe, expect, it } from 'vitest';
import { evaluateFoundationPretest } from '../learningAssessments';
import type { LearningAssessmentQuestion } from '../learningAssessments';

function buildQuestion(
  assessmentIndex: number,
  taxonomy: NonNullable<LearningAssessmentQuestion['taxonomy']>,
  correctIndex = 0,
): LearningAssessmentQuestion {
  return {
    assessmentType: 'pretest',
    assessmentIndex,
    moduleId: `foundations-${assessmentIndex}`,
    moduleTitle: `Module ${assessmentIndex}`,
    moduleEyebrow: 'Foundations',
    questionIndex: assessmentIndex,
    taxonomy,
    question: {
      question: `Question ${assessmentIndex}`,
      options: ['A', 'B'],
      correctIndex,
    },
  };
}

describe('evaluateFoundationPretest', () => {
  it('passes when remembering, understanding, and applying are all correct', () => {
    const questions = [
      buildQuestion(0, 'remembering'),
      buildQuestion(1, 'understanding'),
      buildQuestion(2, 'applying'),
    ];
    const result = evaluateFoundationPretest(questions, { 0: 0, 1: 0, 2: 0 });
    expect(result.passed).toBe(true);
    expect(result.masteredTaxonomies).toEqual(['remembering', 'understanding', 'applying']);
  });

  it('fails when one of the base bloom levels is missing', () => {
    const questions = [
      buildQuestion(0, 'remembering'),
      buildQuestion(1, 'understanding'),
      buildQuestion(2, 'applying'),
    ];
    const result = evaluateFoundationPretest(questions, { 0: 0, 1: 1, 2: 0 });
    expect(result.passed).toBe(false);
    expect(result.missingTaxonomies).toContain('understanding');
  });
});
