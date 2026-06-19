import { describe, expect, it } from 'vitest';
import {
  lessonPagesFor,
  scoreTheoryAssessment,
  visibleTheoryQuestionIndexesFor,
} from '../PatternsLearnPage';
import type { BloomTaxonomy, LearningModule } from '../../../../data/learningModules';

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

function buildModule(): LearningModule {
  return {
    id: 'bloom-module',
    category: 'creational',
    title: 'Bloom Module',
    eyebrow: 'Bloom',
    intro: 'Test module',
    sections: [],
    theoreticalExam: {
      kind: 'theoretical',
      questions: BLOOM_LEVELS.map((taxonomy, index) => ({
        type: 'mcq',
        question: `Question ${index + 1}`,
        options: ['A', 'B'],
        correctIndex: 0,
        taxonomy,
      })),
    },
  };
}

describe('lessonPagesFor', () => {
  it('collapses module content into a single lesson page plus one theoretical page', () => {
    const pages = lessonPagesFor(buildModule());

    expect(pages.map((page) => page.kind)).toEqual(['lesson', 'theoretical']);
    expect(pages.filter((page) => page.kind === 'theoretical')).toHaveLength(1);
  });

  it('drops the theoretical page once every Bloom level is mastered', () => {
    const pages = lessonPagesFor(buildModule(), 6);

    expect(pages.map((page) => page.kind)).toEqual(['lesson']);
  });
});

describe('visibleTheoryQuestionIndexesFor', () => {
  it('shows all six questions when the module has no mastery', () => {
    expect(visibleTheoryQuestionIndexesFor(buildModule())).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('hides questions at or below the mastery number', () => {
    expect(visibleTheoryQuestionIndexesFor(buildModule(), 3)).toEqual([3, 4, 5]);
  });
});

describe('scoreTheoryAssessment', () => {
  it('requires every visible answer before a perfect result can unlock progress', () => {
    const exam = buildModule().theoreticalExam!;

    expect(scoreTheoryAssessment(exam, [0, 1], { 0: 0 })).toEqual({
      answeredCount: 1,
      correctCount: 1,
      totalCount: 2,
      complete: false,
      perfect: false,
    });
  });

  it('reports the recorded score and only marks an all-correct submission perfect', () => {
    const exam = buildModule().theoreticalExam!;

    expect(scoreTheoryAssessment(exam, [0, 1, 2], { 0: 0, 1: 1, 2: 0 })).toEqual({
      answeredCount: 3,
      correctCount: 2,
      totalCount: 3,
      complete: true,
      perfect: false,
    });

    expect(scoreTheoryAssessment(exam, [0, 1, 2], { 0: 0, 1: 0, 2: 0 }).perfect).toBe(true);
  });
});
