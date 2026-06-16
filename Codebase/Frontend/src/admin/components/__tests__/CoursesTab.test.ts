import { describe, expect, it } from 'vitest';
import { hasIncompleteTheoreticalBank } from '../CoursesTab';
import type { AdminLearningModule } from '../../../types/api';

function moduleFixture(overrides: Partial<AdminLearningModule> = {}): AdminLearningModule {
  return {
    id: 'structural-adapter',
    category: 'structural',
    title: 'Adapter',
    eyebrow: 'Structural',
    intro: 'Convert one interface to another.',
    sections: [],
    theoreticalExam: {
      kind: 'theoretical',
      questions: [
        {
          type: 'mcq',
          question: 'Which statement best describes Adapter?',
          options: ['It converts one interface to another.', 'It stores global state.'],
          correctIndex: 0,
        },
      ],
    },
    published: true,
    autoTag: true,
    sortOrder: 0,
    isSeed: true,
    updatedAt: '2026-06-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('CoursesTab bank health', () => {
  it('does not flag sparse legacy banks after learner-contract normalization', () => {
    expect(hasIncompleteTheoreticalBank(moduleFixture())).toBe(false);
  });

  it('still flags modules with no theoretical exam', () => {
    expect(hasIncompleteTheoreticalBank(moduleFixture({ theoreticalExam: undefined }))).toBe(true);
  });
});
