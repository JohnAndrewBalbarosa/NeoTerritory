import type { Database } from 'better-sqlite3';

export type LearningAssessmentType = 'pretest' | 'posttest' | 'posttest2' | 'practical';

export interface AssessmentAnswerSubmission {
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText: string;
  questionKind: 'theoretical' | 'practical';
}

export interface GradedAssessmentAnswer extends AssessmentAnswerSubmission {
  assessmentIndex: number;
  questionTaxonomy: string;
  isCorrect: boolean;
}

export interface LearningAssessmentGrade {
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  results: GradedAssessmentAnswer[];
}

interface LearningModuleQuestionRow {
  module_id: string;
  theoretical_json: string | null;
  practical_json: string | null;
}

interface ExamQuestion {
  type?: 'mcq' | 'identification' | 'studio';
  taxonomy?: string;
  options?: unknown[];
  correctIndex?: number;
  expectedTokens?: unknown[];
}

export class AssessmentGradingError extends Error {}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function theoreticalQuestions(row: LearningModuleQuestionRow): ExamQuestion[] {
  const theory = parseObject(row.theoretical_json);
  return Array.isArray(theory?.questions) ? theory.questions as ExamQuestion[] : [];
}

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseIdentificationResponse(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((value) => String(value));
  } catch {
    // Legacy comma-separated responses remain readable.
  }
  return raw.split(',').map((value) => value.trim());
}

export function isCanonicalAssessmentAnswerCorrect(
  question: ExamQuestion,
  answer: Pick<AssessmentAnswerSubmission, 'selectedIndex' | 'responseText'>,
): boolean {
  const type = question.type ?? (Array.isArray(question.options) ? 'mcq' : undefined);
  if (type === 'mcq') {
    return Number.isInteger(answer.selectedIndex)
      && answer.selectedIndex >= 0
      && answer.selectedIndex === question.correctIndex;
  }
  if (type === 'identification') {
    const expected = Array.isArray(question.expectedTokens) ? question.expectedTokens : [];
    const actual = parseIdentificationResponse(answer.responseText);
    return expected.length > 0
      && actual.length === expected.length
      && expected.every((token, index) => normalizeToken(token) === normalizeToken(actual[index]));
  }
  if (type === 'studio') {
    return answer.responseText.trim().toLowerCase() === 'true';
  }
  return false;
}

export function gradeAssessmentAnswers(
  database: Database,
  answers: ReadonlyArray<AssessmentAnswerSubmission>,
): LearningAssessmentGrade {
  const findModule = database.prepare(`
    SELECT module_id, theoretical_json, practical_json
    FROM learning_modules
    WHERE module_id = ?
  `);
  const seen = new Set<string>();
  const results: GradedAssessmentAnswer[] = [];

  answers.forEach((answer, assessmentIndex) => {
    const key = `${answer.questionKind}:${answer.moduleId}:${answer.questionIndex}`;
    if (seen.has(key)) {
      throw new AssessmentGradingError(`duplicate assessment question: ${answer.moduleId}#${answer.questionIndex}`);
    }
    seen.add(key);

    const row = findModule.get(answer.moduleId) as LearningModuleQuestionRow | undefined;
    if (!row) {
      throw new AssessmentGradingError(`unknown learning module: ${answer.moduleId}`);
    }

    if (answer.questionKind === 'practical') {
      const practical = parseObject(row.practical_json);
      results.push({
        ...answer,
        assessmentIndex,
        questionTaxonomy: typeof practical?.taxonomy === 'string' ? practical.taxonomy : '',
        isCorrect: false,
      });
      return;
    }

    const questions = theoreticalQuestions(row);
    const question = questions[answer.questionIndex];
    if (!question) {
      throw new AssessmentGradingError(`unknown assessment question: ${answer.moduleId}#${answer.questionIndex}`);
    }

    results.push({
      ...answer,
      assessmentIndex,
      questionTaxonomy: typeof question.taxonomy === 'string' ? question.taxonomy : '',
      questionKind: 'theoretical',
      isCorrect: isCanonicalAssessmentAnswerCorrect(question, answer),
    });
  });

  const correctCount = results.reduce((count, result) => count + (result.isCorrect ? 1 : 0), 0);
  const totalCount = results.length;
  return {
    correctCount,
    totalCount,
    scorePercent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
    results,
  };
}

function expectedTaxonomies(assessmentType: LearningAssessmentType): string[] {
  if (assessmentType === 'pretest') {
    return ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating'];
  }
  if (assessmentType === 'posttest') return ['evaluating'];
  if (assessmentType === 'posttest2') return ['creating'];
  return [];
}

export function assertCompleteAssessmentCoverage(
  database: Database,
  assessmentType: LearningAssessmentType,
  answers: ReadonlyArray<AssessmentAnswerSubmission>,
): void {
  const taxonomies = expectedTaxonomies(assessmentType);
  if (taxonomies.length === 0) return;

  const rows = database.prepare(`
    SELECT module_id, theoretical_json, practical_json
    FROM learning_modules
    WHERE published = 1 OR category = 'foundations'
    ORDER BY sort_order ASC
  `).all() as LearningModuleQuestionRow[];

  const expected = new Set<string>();
  for (const row of rows) {
    const questions = theoreticalQuestions(row);
    for (const taxonomy of taxonomies) {
      const questionIndex = questions.findIndex((question) => question.taxonomy === taxonomy);
      if (questionIndex >= 0) expected.add(`${row.module_id}:${questionIndex}`);
    }
  }

  const submitted = new Set(
    answers
      .filter((answer) => answer.questionKind === 'theoretical')
      .map((answer) => `${answer.moduleId}:${answer.questionIndex}`),
  );
  const complete = expected.size === submitted.size
    && Array.from(expected).every((key) => submitted.has(key));
  if (!complete) {
    throw new AssessmentGradingError(
      `assessment coverage mismatch: expected ${expected.size} questions, received ${submitted.size}`,
    );
  }
}
