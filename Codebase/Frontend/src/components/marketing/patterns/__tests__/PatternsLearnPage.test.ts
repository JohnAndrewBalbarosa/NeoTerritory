import { describe, expect, it } from 'vitest';
import {
  lessonPagesFor,
  scoreTheoryAssessment,
  studioPracticalConfig,
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

describe('Practical Exam = Studio (detect-to-pass) wiring', () => {
  // A pattern module: MCQ conceptual questions + one studio (pattern-detection)
  // question + a practicalExam targeting the same pattern.
  const patternModule: LearningModule = {
    id: 'creational-singleton',
    category: 'creational',
    title: 'Singleton',
    eyebrow: 'Creational',
    intro: 'x',
    sections: [],
    theoreticalExam: {
      kind: 'theoretical',
      questions: [
        { type: 'mcq', question: 'concept?', options: ['a', 'b'], correctIndex: 0, taxonomy: 'understanding' },
        { type: 'studio', prompt: 'Build a Singleton', targetPatternSlug: 'singleton', starterCode: 'class S {};', taxonomy: 'applying' },
      ],
    },
    practicalExam: { kind: 'practical', patternSlug: 'singleton', patternName: 'Singleton', family: 'Creational', prompt: 'p', taxonomy: 'applying' },
  } as unknown as LearningModule;

  it('excludes the studio question from the Conceptual Assessment (no duplicate studio)', () => {
    const idxs = visibleTheoryQuestionIndexesFor(patternModule, 0);
    expect(idxs).toEqual([0]); // only the MCQ; the studio (index 1) is dropped
  });

  it('still produces a Practical Exam page when a practicalExam exists', () => {
    const kinds = lessonPagesFor(patternModule, 0).map((p) => p.kind);
    expect(kinds).toContain('practical');
    expect(kinds).toContain('theoretical');
  });

  it('resolves the practical studio config from the authored studio question (slug + starter code)', () => {
    expect(studioPracticalConfig(patternModule)).toEqual({ targetPatternSlug: 'singleton', starterCode: 'class S {};' });
  });

  it('falls back to the practicalExam patternSlug when there is no studio question', () => {
    const noStudio = {
      ...patternModule,
      theoreticalExam: { kind: 'theoretical', questions: [{ type: 'mcq', question: 'q', options: ['a', 'b'], correctIndex: 0, taxonomy: 'understanding' }] },
    } as unknown as LearningModule;
    expect(studioPracticalConfig(noStudio)).toEqual({ targetPatternSlug: 'singleton', starterCode: undefined });
  });

  it('returns null when the module has no detectable target', () => {
    const foundation = { id: 'f', category: 'foundations', title: 'F', eyebrow: 'F', intro: 'x', sections: [], theoreticalExam: { kind: 'theoretical', questions: [{ type: 'mcq', question: 'q', options: ['a', 'b'], correctIndex: 0, taxonomy: 'understanding' }] } } as unknown as LearningModule;
    expect(studioPracticalConfig(foundation)).toBeNull();
  });
});
