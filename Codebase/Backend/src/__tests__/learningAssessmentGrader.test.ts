import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AssessmentGradingError,
  assertCompleteAssessmentCoverage,
  gradeAssessmentAnswers,
  type AssessmentAnswerSubmission,
} from '../services/learningAssessmentGrader';

const TAXONOMIES = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];
const CORRECT_INDICES = [0, 1, 0, 1, 0, 1];

function answers(selectedIndices: number[]): AssessmentAnswerSubmission[] {
  return selectedIndices.map((selectedIndex, questionIndex) => ({
    moduleId: 'creational-singleton',
    questionIndex,
    selectedIndex,
    responseText: '',
    questionKind: 'theoretical',
  }));
}

describe('learning assessment server grading', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE learning_modules (
        module_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        theoretical_json TEXT,
        practical_json TEXT,
        published INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      )
    `);
    const questions = TAXONOMIES.map((taxonomy, index) => ({
      type: 'mcq',
      taxonomy,
      question: `${taxonomy} Singleton question`,
      options: ['A', 'B'],
      correctIndex: CORRECT_INDICES[index],
    }));
    db.prepare(`
      INSERT INTO learning_modules
        (module_id, category, theoretical_json, practical_json, published, sort_order)
      VALUES (?, ?, ?, NULL, 1, 0)
    `).run(
      'creational-singleton',
      'creational',
      JSON.stringify({ kind: 'theoretical', questions }),
    );
  });

  afterEach(() => {
    db.close();
  });

  it('returns a perfect score only when every canonical answer is correct', () => {
    const grade = gradeAssessmentAnswers(db, answers(CORRECT_INDICES));
    expect(grade).toMatchObject({ correctCount: 6, totalCount: 6, scorePercent: 100 });
    expect(grade.results.every((result) => result.isCorrect)).toBe(true);
  });

  it('returns zero when every answer is wrong', () => {
    const wrong = CORRECT_INDICES.map((correct) => correct === 0 ? 1 : 0);
    const grade = gradeAssessmentAnswers(db, answers(wrong));
    expect(grade).toMatchObject({ correctCount: 0, totalCount: 6, scorePercent: 0 });
  });

  it('returns a realistic mixed score for random answers', () => {
    const grade = gradeAssessmentAnswers(db, answers([0, 0, 0, 0, 1, 1]));
    expect(grade).toMatchObject({ correctCount: 3, totalCount: 6, scorePercent: 50 });
    expect(grade.scorePercent).toBeLessThan(100);
  });

  it('counts unanswered questions as incorrect', () => {
    const grade = gradeAssessmentAnswers(db, answers([0, -1, 0, -1, -1, 1]));
    expect(grade).toMatchObject({ correctCount: 3, totalCount: 6, scorePercent: 50 });
    expect(grade.results.filter((result) => result.selectedIndex === -1).every((result) => !result.isCorrect)).toBe(true);
  });

  it('rejects omitted questions when persisting a complete assessment', () => {
    expect(() => assertCompleteAssessmentCoverage(
      db,
      'pretest',
      answers(CORRECT_INDICES).slice(0, 5),
    )).toThrow(AssessmentGradingError);
    expect(() => assertCompleteAssessmentCoverage(
      db,
      'pretest',
      answers(CORRECT_INDICES),
    )).not.toThrow();
  });
});
