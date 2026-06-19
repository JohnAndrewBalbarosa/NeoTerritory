import { describe, expect, it } from 'vitest';
import { deriveInternLearningStatus } from '../internLearningStatus';
import type { LearningModule } from '../../data/learningModules';
import type { LearningAssessmentsResponse } from '../../types/api';

const modules: LearningModule[] = [
  {
    id: 'module-a',
    category: 'foundations',
    title: 'Module A',
    eyebrow: 'A',
    intro: 'A',
    sections: [],
    assessmentForms: {
      A: [{ id: 'module-a:A1', type: 'mcq', question: 'A pre', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
      B: [{ id: 'module-a:B1', type: 'mcq', question: 'A post', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
    },
    theoreticalExam: {
      kind: 'theoretical',
      questions: [{ type: 'mcq', question: 'A', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
    },
  },
  {
    id: 'module-b',
    category: 'creational',
    title: 'Module B',
    eyebrow: 'B',
    intro: 'B',
    sections: [],
    assessmentForms: {
      A: [{ id: 'module-b:A1', type: 'mcq', question: 'B pre', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
      B: [{ id: 'module-b:B1', type: 'mcq', question: 'B post', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
    },
    theoreticalExam: {
      kind: 'theoretical',
      questions: [{ type: 'mcq', question: 'B', options: ['yes', 'no'], correctIndex: 0, taxonomy: 'remembering' }],
    },
  },
];

function assessments(includePosttest = false): LearningAssessmentsResponse {
  return {
    courseUpdatedAt: '2026-01-01T00:00:00Z',
    attempts: [
      { id: 1, assessmentType: 'pretest', sessionId: null, questionCount: 2, cycleId: 'cycle-1', createdAt: '2026-01-02T00:00:00Z' },
      ...(includePosttest
        ? [{ id: 2, assessmentType: 'posttest' as const, sessionId: null, questionCount: 2, cycleId: 'cycle-1', createdAt: '2026-01-03T00:00:00Z' }]
        : []),
    ],
    answers: [
      {
        id: 1, attemptId: 1, assessmentType: 'pretest', assessmentIndex: 0, moduleId: 'module-a',
        questionIndex: 0, questionId: 'module-a:A1', selectedIndex: 0, responseText: null,
        questionTaxonomy: 'remembering', questionKind: 'theoretical', sessionId: null, createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 2, attemptId: 1, assessmentType: 'pretest', assessmentIndex: 1, moduleId: 'module-b',
        questionIndex: 0, questionId: 'module-b:A1', selectedIndex: 1, responseText: null,
        questionTaxonomy: 'remembering', questionKind: 'theoretical', sessionId: null, createdAt: '2026-01-02T00:00:00Z',
      },
      ...(includePosttest
        ? [
          {
            id: 3, attemptId: 2, assessmentType: 'posttest' as const, assessmentIndex: 0, moduleId: 'module-a',
            questionIndex: 0, questionId: 'module-a:B1', selectedIndex: 0, responseText: null,
            questionTaxonomy: 'remembering' as const, questionKind: 'theoretical' as const, sessionId: null, createdAt: '2026-01-03T00:00:00Z',
          },
          {
            id: 4, attemptId: 2, assessmentType: 'posttest' as const, assessmentIndex: 1, moduleId: 'module-b',
            questionIndex: 0, questionId: 'module-b:B1', selectedIndex: 0, responseText: null,
            questionTaxonomy: 'remembering' as const, questionKind: 'theoretical' as const, sessionId: null, createdAt: '2026-01-03T00:00:00Z',
          },
        ]
        : []),
    ],
  };
}

describe('deriveInternLearningStatus', () => {
  it('uses the pre-test standing to identify required modules', () => {
    const status = deriveInternLearningStatus(modules, assessments(), {
      completedModuleIds: [],
      lastUnlockedModuleId: 'module-b',
      theoryPassedModuleIds: [],
    });

    expect(status.pretestScore?.percent).toBe(50);
    expect(status.requiredModuleIds).toEqual(['module-b']);
    expect(status.requiredModulesCompleted).toBe(false);
    expect(status.studioUnlocked).toBe(false);
  });

  it('unlocks Studio only after required modules and the paired post-test are complete', () => {
    const beforePosttest = deriveInternLearningStatus(modules, assessments(), {
      completedModuleIds: ['module-b'],
      lastUnlockedModuleId: 'module-b',
      theoryPassedModuleIds: ['module-b'],
    });
    expect(beforePosttest.requiredModulesCompleted).toBe(true);
    expect(beforePosttest.studioUnlocked).toBe(false);

    const afterPosttest = deriveInternLearningStatus(modules, assessments(true), {
      completedModuleIds: ['module-b'],
      lastUnlockedModuleId: 'module-b',
      theoryPassedModuleIds: ['module-b'],
    });
    expect(afterPosttest.posttestCompleted).toBe(true);
    expect(afterPosttest.studioUnlocked).toBe(true);
  });
});
