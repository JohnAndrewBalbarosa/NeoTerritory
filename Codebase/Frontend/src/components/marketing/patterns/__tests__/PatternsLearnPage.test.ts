import { describe, expect, it } from 'vitest';
import { lessonPagesFor } from '../PatternsLearnPage';
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
  it('shows all six theoretical questions when the module has no mastery', () => {
    const pages = lessonPagesFor(buildModule());

    expect(pages.filter((page) => page.kind === 'theoretical')).toHaveLength(6);
    expect(pages.filter((page) => page.kind === 'theoretical').map((page) => page.label)).toEqual([
      'Quiz Q1',
      'Quiz Q2',
      'Quiz Q3',
      'Quiz Q4',
      'Quiz Q5',
      'Quiz Q6',
    ]);
  });

  it('hides Bloom levels at or below the mastery number', () => {
    const pages = lessonPagesFor(buildModule(), 3);

    expect(pages.filter((page) => page.kind === 'theoretical')).toHaveLength(3);
    expect(pages.filter((page) => page.kind === 'theoretical').map((page) => page.label)).toEqual([
      'Quiz Q4',
      'Quiz Q5',
      'Quiz Q6',
    ]);
  });
});
