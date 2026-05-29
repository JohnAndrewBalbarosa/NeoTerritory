// Client-side aggregation for the Instructor tab (D91).
//
// The Instructor dashboard fetches RAW per-user learning rows from
// GET /api/admin/stats/learning-raw and does ALL aggregation here in the
// browser. Three reductions:
//   1. perStudentRows()      — one summary row per student (scores, attempts,
//                              pass/fail, improvement).
//   2. moduleDifficulty()    — per-module first-try difficulty, hardest-first.
//   3. studentDrilldown()    — per-(module,question) detail for one student,
//                              joined to the catalog (question/option text).
//
// All question/option text is resolved client-side from data/learningModules.ts
// (per D87 — the server does not store question text).

import type {
  AdminLearningRaw,
  LearningRawQuestionResult,
} from '../../types/api';
import { findLearningModule } from '../../data/learningModules';

// ── Per-student summary ───────────────────────────────────────────────────────

export interface InstructorStudentRow {
  userId: number;
  username: string;
  email: string | null;
  modulesCompleted: number;
  theoryPassed: number;
  // Question-answer rollup (from questionResults).
  seen: number;
  firstTryCorrect: number;
  eventualCorrect: number;
  wrong: number; // seen − eventualCorrect
  questionAttempts: number; // Σ attempts across answered questions
  // Exam-attempt rollup (from examAttempts).
  examAttempts: number; // count of submitted attempts
  passCount: number;
  failCount: number;
  // Rates + improvement.
  firstTryRate: number; // firstTryCorrect / seen
  eventualRate: number; // eventualCorrect / seen
  improvement: number; // eventualRate − firstTryRate
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

// One summary row per student. Students with no question/exam rows still appear
// (with zeroed metrics) so the roster stays complete.
export function perStudentRows(raw: AdminLearningRaw): InstructorStudentRow[] {
  const progressByUser = new Map(raw.progress.map((p) => [p.userId, p]));

  // Question-result rollup per user.
  const qByUser = new Map<number, { seen: number; firstTry: number; eventual: number; attempts: number }>();
  for (const q of raw.questionResults) {
    const acc = qByUser.get(q.userId) ?? { seen: 0, firstTry: 0, eventual: 0, attempts: 0 };
    acc.seen += 1;
    acc.firstTry += q.firstAttemptCorrect ? 1 : 0;
    acc.eventual += q.isCorrect ? 1 : 0;
    acc.attempts += q.attempts;
    qByUser.set(q.userId, acc);
  }

  // Exam-attempt rollup per user (pass/fail counts).
  const examByUser = new Map<number, { attempts: number; pass: number; fail: number }>();
  for (const e of raw.examAttempts) {
    const acc = examByUser.get(e.userId) ?? { attempts: 0, pass: 0, fail: 0 };
    acc.attempts += 1;
    if (e.passed) acc.pass += 1;
    else acc.fail += 1;
    examByUser.set(e.userId, acc);
  }

  return raw.students.map((s) => {
    const prog = progressByUser.get(s.userId);
    const q = qByUser.get(s.userId) ?? { seen: 0, firstTry: 0, eventual: 0, attempts: 0 };
    const exam = examByUser.get(s.userId) ?? { attempts: 0, pass: 0, fail: 0 };
    const firstTryRate = rate(q.firstTry, q.seen);
    const eventualRate = rate(q.eventual, q.seen);
    return {
      userId: s.userId,
      username: s.username,
      email: s.email,
      modulesCompleted: prog?.completedModuleIds.length ?? 0,
      theoryPassed: prog?.theoryPassedModuleIds.length ?? 0,
      seen: q.seen,
      firstTryCorrect: q.firstTry,
      eventualCorrect: q.eventual,
      wrong: q.seen - q.eventual,
      questionAttempts: q.attempts,
      examAttempts: exam.attempts,
      passCount: exam.pass,
      failCount: exam.fail,
      firstTryRate,
      eventualRate,
      improvement: eventualRate - firstTryRate,
    };
  });
}

// ── Per-module difficulty ─────────────────────────────────────────────────────

export interface ModuleDifficulty {
  moduleId: string;
  title: string;
  category: string;
  seen: number; // Σ question rows for this module
  firstTryCorrect: number; // Σ first-attempt-correct
  firstTryPassRate: number; // firstTryCorrect / seen
  difficulty: number; // D = 1 − firstTryPassRate
}

// Per-module first-try difficulty, sorted hardest-first (highest D). Only
// modules that have at least one questionResult row appear. Title/category are
// resolved from the catalog; an unknown moduleId falls back to its own id.
export function moduleDifficulty(raw: AdminLearningRaw): ModuleDifficulty[] {
  const byModule = new Map<string, { seen: number; firstTry: number }>();
  for (const q of raw.questionResults) {
    const acc = byModule.get(q.moduleId) ?? { seen: 0, firstTry: 0 };
    acc.seen += 1;
    acc.firstTry += q.firstAttemptCorrect ? 1 : 0;
    byModule.set(q.moduleId, acc);
  }

  const rows: ModuleDifficulty[] = [];
  for (const [moduleId, acc] of byModule) {
    const mod = findLearningModule(moduleId);
    const firstTryPassRate = rate(acc.firstTry, acc.seen);
    rows.push({
      moduleId,
      title: mod?.title ?? moduleId,
      category: mod?.category ?? 'unknown',
      seen: acc.seen,
      firstTryCorrect: acc.firstTry,
      firstTryPassRate,
      difficulty: 1 - firstTryPassRate,
    });
  }

  // Hardest first. Tie-break on moduleId for a stable, deterministic order.
  rows.sort((a, b) => b.difficulty - a.difficulty || a.moduleId.localeCompare(b.moduleId));
  return rows;
}

// ── Per-student drilldown ─────────────────────────────────────────────────────

export interface StudentDrilldownRow {
  moduleId: string;
  moduleTitle: string;
  questionIndex: number;
  questionText: string;
  selectedIndex: number;
  selectedText: string;
  correctIndex: number;
  correctText: string;
  isCorrect: boolean;
  firstAttemptCorrect: boolean;
  attempts: number;
}

function questionTextFor(moduleId: string, qi: number): string {
  return findLearningModule(moduleId)?.theoreticalExam?.questions[qi]?.question ?? `Q${qi + 1}`;
}

function optionTextFor(moduleId: string, qi: number, oi: number): string {
  const opt = findLearningModule(moduleId)?.theoreticalExam?.questions[qi]?.options[oi];
  return opt ?? `Option ${oi + 1}`;
}

function correctIndexFor(moduleId: string, qi: number): number {
  return findLearningModule(moduleId)?.theoreticalExam?.questions[qi]?.correctIndex ?? -1;
}

// All of one student's per-(module,question) results, joined to the catalog so
// each row carries the question text, the student's chosen option text, and the
// correct option text. Sorted by module then question for a stable read.
export function studentDrilldown(raw: AdminLearningRaw, userId: number): StudentDrilldownRow[] {
  const rows = raw.questionResults
    .filter((q) => q.userId === userId)
    .map((q: LearningRawQuestionResult): StudentDrilldownRow => {
      const correctIndex = correctIndexFor(q.moduleId, q.questionIndex);
      return {
        moduleId: q.moduleId,
        moduleTitle: findLearningModule(q.moduleId)?.title ?? q.moduleId,
        questionIndex: q.questionIndex,
        questionText: questionTextFor(q.moduleId, q.questionIndex),
        selectedIndex: q.selectedIndex,
        selectedText: optionTextFor(q.moduleId, q.questionIndex, q.selectedIndex),
        correctIndex,
        correctText: correctIndex >= 0 ? optionTextFor(q.moduleId, q.questionIndex, correctIndex) : '—',
        isCorrect: Boolean(q.isCorrect),
        firstAttemptCorrect: Boolean(q.firstAttemptCorrect),
        attempts: q.attempts,
      };
    });

  rows.sort(
    (a, b) => a.moduleTitle.localeCompare(b.moduleTitle) || a.questionIndex - b.questionIndex,
  );
  return rows;
}
