import type { ExamQuestion, LearningModule } from './learningModules';

export type LearningAssessmentType = 'pretest' | 'posttest' | 'posttest2';

export interface LearningAssessmentQuestion {
  assessmentType: LearningAssessmentType;
  assessmentIndex: number;
  moduleId: string;
  moduleTitle: string;
  moduleEyebrow: string;
  questionIndex: number;
  question: ExamQuestion;
}

export interface LearningAssessmentAnswerInput {
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
}

export interface LearningAssessmentMeta {
  eyebrow: string;
  badge: string;
  title: string;
  intro: string;
  submitLabel: string;
  continueLabel: string;
  nextPath: string;
}

export const LEARNING_ASSESSMENT_META: Record<LearningAssessmentType, LearningAssessmentMeta> = {
  pretest: {
    eyebrow: 'Learning gate',
    badge: 'PRE',
    title: 'Baseline Assessment: Pre-Test',
    intro:
      'This baseline uses raw module questions. The browser checks the answers locally; only the selected answers are persisted to the database.',
    submitLabel: 'Finish Pre-test & Start Learning',
    continueLabel: 'Continue to Learning Path',
    nextPath: '/patterns/learn',
  },
  posttest: {
    eyebrow: 'Learning outcome',
    badge: 'POST',
    title: 'Post-Test',
    intro:
      'This checkpoint samples later module questions. The server stores raw selections only; scoring and interpretation stay in the browser.',
    submitLabel: 'Save Post-test',
    continueLabel: 'Continue to Post-Test 2',
    nextPath: '/post-test-2',
  },
  posttest2: {
    eyebrow: 'Learning outcome',
    badge: 'POST 2',
    title: 'Post-Test, Part 2',
    intro:
      'This follow-up checkpoint reuses module questions with a different slice. The browser computes the result and the database keeps raw answers only.',
    submitLabel: 'Finish Final Checkpoint',
    continueLabel: 'Return to Learning Path',
    nextPath: '/patterns/learn',
  },
};

const ASSESSMENT_PLAN: Record<LearningAssessmentType, { moduleStart: number; moduleCount: number; questionOffset: number }> = {
  pretest: { moduleStart: 0, moduleCount: 8, questionOffset: 0 },
  posttest: { moduleStart: 8, moduleCount: 8, questionOffset: 1 },
  posttest2: { moduleStart: 16, moduleCount: 8, questionOffset: 2 },
};

export function buildLearningAssessmentQuestions(
  modules: ReadonlyArray<LearningModule>,
  assessmentType: LearningAssessmentType,
): LearningAssessmentQuestion[] {
  const plan = ASSESSMENT_PLAN[assessmentType];
  const eligible = modules.filter((module) => module.theoreticalExam?.questions.length);
  return eligible
    .slice(plan.moduleStart, plan.moduleStart + plan.moduleCount)
    .map((module, assessmentIndex) => {
      const questions = module.theoreticalExam!.questions;
      const questionIndex = Math.min(plan.questionOffset, questions.length - 1);
      return {
        assessmentType,
        assessmentIndex,
        moduleId: module.id,
        moduleTitle: module.title,
        moduleEyebrow: module.eyebrow,
        questionIndex,
        question: questions[questionIndex],
      };
    });
}

export interface LearningAssessmentResult {
  assessmentIndex: number;
  moduleId: string;
  questionIndex: number;
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export function gradeLearningAssessment(
  questions: ReadonlyArray<LearningAssessmentQuestion>,
  answers: Record<number, number | null | undefined>,
): {
  results: LearningAssessmentResult[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
} {
  const results = questions.map((item) => {
    const selected = answers[item.assessmentIndex];
    const selectedIndex = Number.isInteger(selected) ? Number(selected) : null;
    const isCorrect = selectedIndex != null && selectedIndex === item.question.correctIndex;
    return {
      assessmentIndex: item.assessmentIndex,
      moduleId: item.moduleId,
      questionIndex: item.questionIndex,
      correctIndex: item.question.correctIndex,
      selectedIndex,
      isCorrect,
    };
  });

  const correctCount = results.filter((result) => result.isCorrect).length;
  const totalCount = results.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return { results, correctCount, totalCount, scorePercent };
}
