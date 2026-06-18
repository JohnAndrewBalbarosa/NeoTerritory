import { describe, expect, it } from 'vitest';
import type { LearningAssessmentsResponse } from '../../types/api';
import type { LearningModule } from '../../data/learningModules';
import { derivePretestModuleOutcomes, masteryLevelForBloomLevels } from '../pretestModuleOutcomes';

function moduleFixture(
  id: string,
  questions: Array<{ taxonomy: NonNullable<LearningModule['theoreticalExam']>['questions'][number]['taxonomy']; correctIndex: number }>,
): LearningModule {
  return {
    id,
    category: 'creational',
    title: id,
    eyebrow: id,
    intro: id,
    sections: [],
    theoreticalExam: {
      kind: 'theoretical',
      questions: questions.map((question, index) => ({
        type: 'mcq',
        question: `${id} q${index + 1}`,
        options: ['A', 'B'],
        correctIndex: question.correctIndex,
        taxonomy: question.taxonomy,
      })),
    },
  };
}

function response(overrides: Partial<LearningAssessmentsResponse> = {}): LearningAssessmentsResponse {
  return {
    attempts: [],
    answers: [],
    courseUpdatedAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('derivePretestModuleOutcomes', () => {
  const modules: LearningModule[] = [
    moduleFixture('module-a', [
      { taxonomy: 'remembering', correctIndex: 0 },
      { taxonomy: 'understanding', correctIndex: 1 },
    ]),
    moduleFixture('module-b', [
      { taxonomy: 'applying', correctIndex: 0 },
    ]),
    moduleFixture('module-c', [
      { taxonomy: 'analyzing', correctIndex: 1 },
    ]),
    moduleFixture('module-d', [
      { taxonomy: 'remembering', correctIndex: 0 },
      { taxonomy: 'remembering', correctIndex: 1 },
      { taxonomy: 'understanding', correctIndex: 0 },
    ]),
  ];

  it('uses only the latest fresh pretest attempt and scores module outcomes from that attempt', () => {
    const result = derivePretestModuleOutcomes(modules, response({
      attempts: [
        {
          id: 1,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 3,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
        {
          id: 2,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 3,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 3,
          assessmentType: 'posttest',
          sessionId: null,
          questionCount: 3,
          createdAt: '2026-06-15T03:00:00.000Z',
        },
      ],
      answers: [
        {
          id: 11,
          attemptId: 1,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'module-a',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
        {
          id: 12,
          attemptId: 1,
          assessmentType: 'pretest',
          assessmentIndex: 1,
          moduleId: 'module-b',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'applying',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
        {
          id: 21,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'module-a',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 22,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 1,
          moduleId: 'module-a',
          questionIndex: 1,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'understanding',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 23,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 2,
          moduleId: 'module-b',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'applying',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 24,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 3,
          moduleId: 'module-c',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'analyzing',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 25,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 4,
          moduleId: 'module-d',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
        {
          id: 26,
          attemptId: 2,
          assessmentType: 'pretest',
          assessmentIndex: 5,
          moduleId: 'module-d',
          questionIndex: 2,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'understanding',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T02:00:00.000Z',
        },
      ],
    }));

    expect(result.latestAttemptId).toBe(2);
    expect(result.masteredBloomLevelsByModuleId).toEqual({
      'module-a': ['remembering', 'understanding'],
      'module-c': ['analyzing'],
      'module-d': ['remembering', 'understanding'],
    });
    expect(result.bloomMasteryByModuleId).toEqual({
      'module-a': 6,
      'module-c': 6,
      'module-d': 6,
    });
    expect(result.failedModuleIds).toEqual(['module-b']);
    expect(result.exemptModuleIds).toEqual(['module-a', 'module-c', 'module-d']);
    expect(result.perfectModuleIds).toEqual(['module-a', 'module-c', 'module-d']);
  });

  it('treats partial coverage as non-exempt and ignores stale pretests before the course update', () => {
    const result = derivePretestModuleOutcomes(modules, response({
      courseUpdatedAt: '2026-06-15T00:30:00.000Z',
      attempts: [
        {
          id: 10,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 2,
          createdAt: '2026-06-15T00:10:00.000Z',
        },
        {
          id: 11,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 2,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
      ],
      answers: [
        {
          id: 101,
          attemptId: 10,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'module-c',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'analyzing',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T00:10:00.000Z',
        },
        {
          id: 111,
          attemptId: 11,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'module-a',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
      ],
    }));

    expect(result.latestAttemptId).toBe(11);
    expect(result.masteredBloomLevelsByModuleId).toEqual({
      'module-a': ['remembering'],
    });
    expect(result.bloomMasteryByModuleId).toEqual({
      'module-a': 1,
    });
    expect(result.failedModuleIds).toEqual([]);
    expect(result.exemptModuleIds).toEqual([]);
    expect(result.perfectModuleIds).toEqual([]);
  });

  it('uses backend-authoritative correctness for learning recommendations', () => {
    const result = derivePretestModuleOutcomes(modules, response({
      attempts: [{
        id: 20,
        assessmentType: 'pretest',
        sessionId: null,
        questionCount: 2,
        correctCount: 1,
        scorePercent: 50,
        createdAt: '2026-06-15T04:00:00.000Z',
      }],
      answers: [
        {
          id: 201,
          attemptId: 20,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'module-a',
          questionIndex: 0,
          selectedIndex: 0,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          isCorrect: false,
          sessionId: null,
          createdAt: '2026-06-15T04:00:00.000Z',
        },
        {
          id: 202,
          attemptId: 20,
          assessmentType: 'pretest',
          assessmentIndex: 1,
          moduleId: 'module-b',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'applying',
          questionKind: 'theoretical',
          isCorrect: true,
          sessionId: null,
          createdAt: '2026-06-15T04:00:00.000Z',
        },
      ],
    }));

    expect(result.failedModuleIds).toContain('module-a');
    expect(result.masteredBloomLevelsByModuleId['module-a']).toBeUndefined();
    expect(result.exemptModuleIds).toContain('module-b');
  });
});

describe('masteryLevelForBloomLevels', () => {
  it('collapses mastered Bloom levels to the highest level number', () => {
    expect(masteryLevelForBloomLevels([])).toBe(0);
    expect(masteryLevelForBloomLevels(['remembering'])).toBe(1);
    expect(masteryLevelForBloomLevels(['remembering', 'evaluating', 'applying'])).toBe(5);
  });
});
