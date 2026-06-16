import { describe, expect, it } from 'vitest';
import { validateLearningModule } from '../payloadValidator';

const baseModule = {
  id: 'creational-test-bank',
  category: 'creational',
  title: 'Test Bank',
  eyebrow: 'Creational',
  intro: 'Mixed bank fixture.',
  sections: [],
};

describe('validateLearningModule', () => {
  it('accepts mixed theoretical question banks without stripping taxonomy', () => {
    const result = validateLearningModule({
      ...baseModule,
      theoreticalExam: {
        kind: 'theoretical',
        questions: [
          {
            type: 'mcq',
            taxonomy: 'remembering',
            question: 'What is Singleton?',
            options: ['One instance', 'Many instances'],
            correctIndex: 0,
            explanation: 'Singleton controls instance count.',
          },
          {
            type: 'identification',
            taxonomy: 'analyzing',
            question: 'Name the pattern.',
            scenario: 'A class hides its constructor and exposes instance().',
            expectedTokens: ['singleton'],
          },
          {
            type: 'studio',
            taxonomy: 'creating',
            prompt: 'Implement a Singleton.',
            targetPatternSlug: 'singleton',
            starterCode: 'class Store {};',
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.theoreticalExam?.questions).toEqual([
      expect.objectContaining({ type: 'mcq', taxonomy: 'remembering' }),
      expect.objectContaining({ type: 'identification', taxonomy: 'analyzing' }),
      expect.objectContaining({ type: 'studio', taxonomy: 'creating' }),
    ]);
  });

  it('normalizes legacy MCQ questions that omit type', () => {
    const result = validateLearningModule({
      ...baseModule,
      theoreticalExam: {
        kind: 'theoretical',
        questions: [
          {
            taxonomy: 'understanding',
            question: 'Why hide construction?',
            options: ['To control creation', 'To remove all methods'],
            correctIndex: 0,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.theoreticalExam?.questions[0]).toEqual(
      expect.objectContaining({ type: 'mcq', taxonomy: 'understanding' }),
    );
  });

  it('rejects incomplete identification and studio questions', () => {
    const badIdentification = validateLearningModule({
      ...baseModule,
      theoreticalExam: {
        kind: 'theoretical',
        questions: [{ type: 'identification', question: 'Name it.', scenario: '', expectedTokens: [] }],
      },
    });
    expect(badIdentification.ok).toBe(false);

    const badStudio = validateLearningModule({
      ...baseModule,
      theoreticalExam: {
        kind: 'theoretical',
        questions: [{ type: 'studio', prompt: 'Build it.', targetPatternSlug: '' }],
      },
    });
    expect(badStudio.ok).toBe(false);
  });
});
