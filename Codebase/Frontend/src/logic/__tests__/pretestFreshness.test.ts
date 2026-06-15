import { describe, expect, it } from 'vitest';
import type { LearningAssessmentsResponse } from '../../types/api';
import { hasFreshSavedPretest } from '../pretestFreshness';

function response(overrides: Partial<LearningAssessmentsResponse> = {}): LearningAssessmentsResponse {
  return {
    attempts: [],
    answers: [],
    courseUpdatedAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('hasFreshSavedPretest', () => {
  it('requires a pretest attempt with recorded answers after the course update', () => {
    expect(hasFreshSavedPretest(response({
      attempts: [
        {
          id: 10,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 3,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
      ],
      answers: [
        {
          id: 99,
          attemptId: 10,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'foundations-what-is-pattern',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
      ],
    }))).toBe(true);
  });

  it('rejects stale or empty pretest attempts', () => {
    expect(hasFreshSavedPretest(response({
      attempts: [
        {
          id: 11,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 3,
          createdAt: '2026-06-14T23:59:59.000Z',
        },
      ],
      answers: [
        {
          id: 100,
          attemptId: 11,
          assessmentType: 'pretest',
          assessmentIndex: 0,
          moduleId: 'foundations-what-is-pattern',
          questionIndex: 0,
          selectedIndex: 1,
          responseText: null,
          questionTaxonomy: 'remembering',
          questionKind: 'theoretical',
          sessionId: null,
          createdAt: '2026-06-14T23:59:59.000Z',
        },
      ],
    }))).toBe(false);

    expect(hasFreshSavedPretest(response({
      attempts: [
        {
          id: 12,
          assessmentType: 'pretest',
          sessionId: null,
          questionCount: 0,
          createdAt: '2026-06-15T01:00:00.000Z',
        },
      ],
      answers: [],
    }))).toBe(false);
  });
});
