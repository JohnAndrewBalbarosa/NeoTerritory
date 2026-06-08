import type { BloomTaxonomy, ExamQuestion, LearningModule } from './learningModules';

export type LearningAssessmentType = 'pretest' | 'posttest' | 'posttest2' | 'practical';

export interface LearningAssessmentQuestion {
  assessmentType: LearningAssessmentType;
  assessmentIndex: number;
  moduleId: string;
  moduleTitle: string;
  moduleEyebrow: string;
  questionIndex: number;
  question: ExamQuestion;
  taxonomy: BloomTaxonomy;
}

const BLOOM_PATHS: Record<Exclude<LearningAssessmentType, 'practical'>, BloomTaxonomy[]> = {
  pretest: ['remembering', 'understanding', 'applying', 'remembering', 'understanding', 'applying', 'analyzing', 'remembering'],
  posttest: ['analyzing', 'evaluating', 'creating', 'analyzing', 'evaluating', 'creating', 'applying', 'analyzing'],
  posttest2: ['remembering', 'applying', 'analyzing', 'evaluating', 'creating', 'understanding', 'applying', 'evaluating'],
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: ReadonlyArray<T>, seed: string): T[] {
  const out = [...items];
  let state = hashString(seed) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickQuestionForTaxonomy(module: LearningModule, taxonomy: BloomTaxonomy): [ExamQuestion, number] | null {
  const qs = module.theoreticalExam?.questions || [];
  const exact = qs.findIndex((q) => q.taxonomy === taxonomy);
  if (exact >= 0) return [qs[exact], exact];
  if (qs.length > 0) return [qs[0], 0];
  return null;
}

export interface LearningAssessmentAnswerInput {
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText?: string | null;
  questionTaxonomy?: BloomTaxonomy | null;
  questionKind?: 'theoretical' | 'practical';
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
  practical: {
    eyebrow: 'Studio checkpoint',
    badge: 'PRACTICAL',
    title: 'Practical Answer Capture',
    intro:
      'This capture stores the raw practical answer or code output for instructor review. It is saved separately from the MCQ checkpoints.',
    submitLabel: 'Save Practical Answer',
    continueLabel: 'Return to Learning Path',
    nextPath: '/patterns/learn',
  },
};

export function buildLearningAssessmentQuestions(
  modules: ReadonlyArray<LearningModule>,
  assessmentType: LearningAssessmentType,
): LearningAssessmentQuestion[] {
  const eligible = modules.filter((module) => module.theoreticalExam?.questions.length);
  if (assessmentType === 'practical') return [];
  const plan = BLOOM_PATHS[assessmentType];
  const rotated = seededShuffle(eligible, `${assessmentType}:module-order`);
  return rotated.slice(0, 8).map((module, assessmentIndex) => {
    const taxonomy = plan[assessmentIndex % plan.length];
    const picked = pickQuestionForTaxonomy(module, taxonomy) ?? [module.theoreticalExam!.questions[0], 0];
    return {
      assessmentType,
      assessmentIndex,
      moduleId: module.id,
      moduleTitle: module.title,
      moduleEyebrow: module.eyebrow,
      questionIndex: picked[1],
      question: picked[0],
      taxonomy,
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
