import type { LearningAssessmentsResponse } from '../types/api';

function toTime(value: string | undefined): number | null {
  if (!value) return null;
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'. JS Date()
  // parses that as local time unless it has a 'Z' or offset. Force UTC.
  const utcValue = value.includes('T') || value.includes('Z') ? value : value.replace(' ', 'T') + 'Z';
  const time = new Date(utcValue).getTime();
  return Number.isFinite(time) ? time : null;
}

export function hasFreshSavedPretest(assessments: LearningAssessmentsResponse): boolean {
  const courseUpdatedAt = toTime(assessments.courseUpdatedAt);

  return assessments.attempts.some((attempt) => {
    if (attempt.assessmentType !== 'pretest') return false;
    if (attempt.questionCount <= 0) return false;
    const createdAt = toTime(attempt.createdAt);
    if (createdAt == null) return false;
    if (courseUpdatedAt != null && createdAt < courseUpdatedAt) return false;
    return assessments.answers.some((answer) => answer.attemptId === attempt.id);
  });
}
