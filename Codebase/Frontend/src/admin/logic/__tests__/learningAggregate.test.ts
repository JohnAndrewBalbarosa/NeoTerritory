import { describe, it, expect } from 'vitest';
import type { AdminLearningRaw } from '../../../types/api';
import { findLearningModule, isIdentificationQuestion, isMcqQuestion } from '../../../data/learningModules';
import {
  perStudentRows,
  moduleDifficulty,
  studentDrilldown,
} from '../learningAggregate';

// Real catalog module IDs so catalog resolution is exercised.
const MOD_A = 'creational-builder'; // Contains MCQ at 0 and identification at 2
const MOD_B = 'foundations-why-matters'; // ≥2 theory questions

function emptyRaw(): AdminLearningRaw {
  return { students: [], progress: [], questionResults: [], examAttempts: [] };
}

describe('perStudentRows', () => {
  it('rolls up seen / wrong / improvement and pass-fail from a small fixture', () => {
    // Arrange — one student: 3 seen, 1 first-try correct, 2 eventual correct.
    const raw: AdminLearningRaw = {
      students: [{ userId: 1, username: 'Ana', email: 'ana@example.com', createdVia: 'oauth' }],
      progress: [{
        userId: 1,
        completedModuleIds: [MOD_A, MOD_B],
        lastUnlockedModuleId: MOD_B,
        triesByModule: { [MOD_A]: 2 },
        theoryPassedModuleIds: [MOD_A],
        bloomMasteryByModule: { [MOD_A]: 6 },
        updatedAt: '2026-05-29T00:00:00Z',
      }],
      questionResults: [
        { userId: 1, moduleId: MOD_A, questionIndex: 0, selectedIndex: 1, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 1, moduleId: MOD_A, questionIndex: 1, selectedIndex: 0, isCorrect: 1, firstAttemptCorrect: 0, attempts: 3, updatedAt: 't' },
        { userId: 1, moduleId: MOD_A, questionIndex: 2, selectedIndex: 2, isCorrect: 0, firstAttemptCorrect: 0, attempts: 2, updatedAt: 't' },
      ],
      examAttempts: [
        { id: 1, userId: 1, moduleId: MOD_A, attemptNo: 1, correctCount: 1, totalQuestions: 3, passed: 0, createdAt: 't' },
        { id: 2, userId: 1, moduleId: MOD_A, attemptNo: 2, correctCount: 3, totalQuestions: 3, passed: 1, createdAt: 't' },
      ],
    };

    // Act
    const [row] = perStudentRows(raw);

    // Assert
    expect(row.seen).toBe(3);
    expect(row.firstTryCorrect).toBe(1);
    expect(row.eventualCorrect).toBe(2);
    expect(row.wrong).toBe(1); // seen − eventual
    expect(row.questionAttempts).toBe(6); // 1 + 3 + 2
    expect(row.modulesCompleted).toBe(2);
    expect(row.theoryPassed).toBe(1);
    expect(row.examAttempts).toBe(2);
    expect(row.passCount).toBe(1);
    expect(row.failCount).toBe(1);
    expect(row.firstTryRate).toBeCloseTo(1 / 3, 5);
    expect(row.eventualRate).toBeCloseTo(2 / 3, 5);
    expect(row.improvement).toBeCloseTo(1 / 3, 5); // eventual − firstTry
  });

  it('keeps a student with no activity in the roster with zeroed metrics', () => {
    // Arrange
    const raw: AdminLearningRaw = {
      ...emptyRaw(),
      students: [{ userId: 9, username: 'Quiet', email: null, createdVia: 'oauth' }],
    };

    // Act
    const [row] = perStudentRows(raw);

    // Assert
    expect(row.seen).toBe(0);
    expect(row.wrong).toBe(0);
    expect(row.improvement).toBe(0);
    expect(row.passCount).toBe(0);
    expect(row.failCount).toBe(0);
  });
});

describe('moduleDifficulty', () => {
  it('orders modules hardest-first and computes D = 1 − first-try pass rate', () => {
    // Arrange — MOD_A: 4 seen / 1 first-try (D=0.75); MOD_B: 4 seen / 3 first-try (D=0.25).
    const raw: AdminLearningRaw = {
      ...emptyRaw(),
      questionResults: [
        { userId: 1, moduleId: MOD_A, questionIndex: 0, selectedIndex: 0, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 2, moduleId: MOD_A, questionIndex: 0, selectedIndex: 0, isCorrect: 0, firstAttemptCorrect: 0, attempts: 1, updatedAt: 't' },
        { userId: 3, moduleId: MOD_A, questionIndex: 0, selectedIndex: 0, isCorrect: 0, firstAttemptCorrect: 0, attempts: 1, updatedAt: 't' },
        { userId: 4, moduleId: MOD_A, questionIndex: 0, selectedIndex: 0, isCorrect: 0, firstAttemptCorrect: 0, attempts: 1, updatedAt: 't' },
        { userId: 1, moduleId: MOD_B, questionIndex: 0, selectedIndex: 0, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 2, moduleId: MOD_B, questionIndex: 0, selectedIndex: 0, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 3, moduleId: MOD_B, questionIndex: 0, selectedIndex: 0, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 4, moduleId: MOD_B, questionIndex: 0, selectedIndex: 0, isCorrect: 0, firstAttemptCorrect: 0, attempts: 1, updatedAt: 't' },
      ],
    };

    // Act
    const rows = moduleDifficulty(raw);

    // Assert — hardest (MOD_A, D=0.75) before easier (MOD_B, D=0.25).
    expect(rows.map((r) => r.moduleId)).toEqual([MOD_A, MOD_B]);
    expect(rows[0].difficulty).toBeCloseTo(0.75, 5);
    expect(rows[0].seen).toBe(4);
    expect(rows[0].firstTryPassRate).toBeCloseTo(0.25, 5);
    expect(rows[1].difficulty).toBeCloseTo(0.25, 5);
    // Title resolved from the catalog, not the raw id.
    expect(rows[0].title).toBe(findLearningModule(MOD_A)?.title);
  });

  it('returns nothing for modules with no question results', () => {
    expect(moduleDifficulty(emptyRaw())).toEqual([]);
  });
});

describe('studentDrilldown', () => {
  it('joins a student answer to catalog question + option text', () => {
    // Arrange — answer MOD_A Q0 with the wrong option (catalog correctIndex is 1).
    const q0 = findLearningModule(MOD_A)?.theoreticalExam?.questions[0];
    if (!q0 || !isMcqQuestion(q0)) throw new Error('MOD_A Q0 should be an MCQ');

    const correctIndex = q0.correctIndex;
    const wrongIndex = correctIndex === 0 ? 2 : 0;
    const raw: AdminLearningRaw = {
      ...emptyRaw(),
      questionResults: [
        { userId: 1, moduleId: MOD_A, questionIndex: 0, selectedIndex: wrongIndex, isCorrect: 0, firstAttemptCorrect: 0, attempts: 2, updatedAt: 't' },
      ],
    };

    // Act
    const [row] = studentDrilldown(raw, 1);

    // Assert
    expect(row.questionType).toBe('mcq');
    expect(row.questionText).toBe(q0.question);
    expect(row.selectedText).toBe(q0.options[wrongIndex]);
    expect(row.correctIndex).toBe(correctIndex);
    expect(row.correctText).toBe(q0.options[correctIndex]);
    expect(row.isCorrect).toBe(false);
    expect(row.firstAttemptCorrect).toBe(false);
    expect(row.attempts).toBe(2);
  });

  it('labels identification questions without fake option text', () => {
    const q2 = findLearningModule(MOD_A)?.theoreticalExam?.questions[2];
    if (!q2 || !isIdentificationQuestion(q2)) throw new Error('MOD_A Q2 should be identification');

    const raw: AdminLearningRaw = {
      ...emptyRaw(),
      questionResults: [
        { userId: 1, moduleId: MOD_A, questionIndex: 2, selectedIndex: -1, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
      ],
    };

    const [row] = studentDrilldown(raw, 1);

    expect(row.questionType).toBe('identification');
    expect(row.questionText).toBe(q2.question);
    expect(row.selectedText).toBe('Identification response');
    expect(row.correctIndex).toBe(-1);
    expect(row.correctText).toBe(q2.expectedTokens.join(', '));
  });

  it('returns only the requested student rows', () => {
    // Arrange
    const raw: AdminLearningRaw = {
      ...emptyRaw(),
      questionResults: [
        { userId: 1, moduleId: MOD_A, questionIndex: 0, selectedIndex: 1, isCorrect: 1, firstAttemptCorrect: 1, attempts: 1, updatedAt: 't' },
        { userId: 2, moduleId: MOD_A, questionIndex: 0, selectedIndex: 0, isCorrect: 0, firstAttemptCorrect: 0, attempts: 1, updatedAt: 't' },
      ],
    };

    // Act + Assert
    expect(studentDrilldown(raw, 1)).toHaveLength(1);
    expect(studentDrilldown(raw, 2)).toHaveLength(1);
    expect(studentDrilldown(raw, 3)).toHaveLength(0);
  });
});
