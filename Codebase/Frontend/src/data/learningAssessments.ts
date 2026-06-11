import type { LearningAssessmentAnswerRaw, LearningAssessmentAttemptRaw, LearningAssessmentsResponse } from '../types/api';
import {
  FOUNDATION_BYPASS_TAXONOMIES,
  type BloomTaxonomy,
  type ExamQuestion,
  type LearningModule,
  normalizeLearningModules,
  isFoundationModule,
} from './learningModules';

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
  return exact >= 0 ? [qs[exact], exact] : null;
}

interface AssessmentQuestionCandidate {
  module: LearningModule;
  picked: [ExamQuestion, number];
  questionKey: string;
}

function collectQuestionCandidates(
  modules: ReadonlyArray<LearningModule>,
  taxonomy: BloomTaxonomy,
): AssessmentQuestionCandidate[] {
  return modules.flatMap((module) => {
    const picked = pickQuestionForTaxonomy(module, taxonomy);
    if (!picked) return [];
    return [{
      module,
      picked,
      questionKey: `${module.id}:${picked[1]}`,
    }];
  });
}

function chooseQuestionCandidate(
  modules: ReadonlyArray<LearningModule>,
  taxonomy: BloomTaxonomy,
  assessmentType: Exclude<LearningAssessmentType, 'practical'>,
  assessmentIndex: number,
  usedModuleIds: Set<string>,
  usedQuestionKeys: Set<string>,
): AssessmentQuestionCandidate {
  const candidates = collectQuestionCandidates(modules, taxonomy);
  if (candidates.length === 0) {
    throw new Error(`Assessment ${assessmentType} requires a ${taxonomy} question, but the module bank has none after normalization.`);
  }

  return candidates.find((candidate) => !usedModuleIds.has(candidate.module.id) && !usedQuestionKeys.has(candidate.questionKey))
    ?? candidates.find((candidate) => !usedQuestionKeys.has(candidate.questionKey))
    ?? candidates[assessmentIndex % candidates.length];
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
  const normalizedModules = normalizeLearningModules(modules);
  const foundationEligible = normalizedModules.filter(
    (module) => module.category === 'foundations' && module.theoreticalExam?.questions.length,
  );
  const eligible = assessmentType === 'pretest' && foundationEligible.length > 0
    ? foundationEligible
    : normalizedModules.filter((module) => module.theoreticalExam?.questions.length);
  if (assessmentType === 'practical') return [];
  const plan = BLOOM_PATHS[assessmentType];
  const rotated = seededShuffle(eligible, `${assessmentType}:module-order`);
  const usedModuleIds = new Set<string>();
  const usedQuestionKeys = new Set<string>();
  return plan.map((taxonomy, assessmentIndex) => {
    const { module, picked, questionKey } = chooseQuestionCandidate(
      rotated,
      taxonomy,
      assessmentType,
      assessmentIndex,
      usedModuleIds,
      usedQuestionKeys,
    );
    usedModuleIds.add(module.id);
    usedQuestionKeys.add(questionKey);
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

export interface FoundationPretestEvidence {
  passed: boolean;
  masteredTaxonomies: BloomTaxonomy[];
  missingTaxonomies: BloomTaxonomy[];
  correctCount: number;
  totalCount: number;
  latestAttemptId: number | null;
  matchedModuleIds: string[];
}

function isFoundationTaxonomy(value: BloomTaxonomy | null | undefined): value is (typeof FOUNDATION_BYPASS_TAXONOMIES)[number] {
  return typeof value === 'string' && (FOUNDATION_BYPASS_TAXONOMIES as ReadonlyArray<BloomTaxonomy>).includes(value);
}

function latestPretestAttempt(attempts: ReadonlyArray<LearningAssessmentAttemptRaw>): LearningAssessmentAttemptRaw | null {
  const pretests = attempts.filter((attempt) => attempt.assessmentType === 'pretest');
  if (pretests.length === 0) return null;
  const sorted = [...pretests].sort((a, b) => {
    const timeCompare = String(a.createdAt).localeCompare(String(b.createdAt));
    if (timeCompare !== 0) return timeCompare;
    return a.id - b.id;
  });
  return sorted[sorted.length - 1] ?? null;
}

export function evaluateFoundationPretest(
  questions: ReadonlyArray<LearningAssessmentQuestion>,
  answers: Record<number, number | null | undefined>,
): FoundationPretestEvidence {
  const mastered = new Set<BloomTaxonomy>();
  const matchedModuleIds = new Set<string>();
  let correctCount = 0;

  for (const item of questions) {
    const selected = answers[item.assessmentIndex];
    const selectedIndex = Number.isInteger(selected) ? Number(selected) : null;
    const isCorrect = selectedIndex != null && selectedIndex === item.question.correctIndex;
    if (!isCorrect) continue;
    correctCount += 1;
    if (isFoundationTaxonomy(item.taxonomy)) {
      mastered.add(item.taxonomy);
      matchedModuleIds.add(item.moduleId);
    }
  }

  const masteredTaxonomies = FOUNDATION_BYPASS_TAXONOMIES.filter((taxonomy) => mastered.has(taxonomy));
  return {
    passed: FOUNDATION_BYPASS_TAXONOMIES.every((taxonomy) => mastered.has(taxonomy)),
    masteredTaxonomies,
    missingTaxonomies: FOUNDATION_BYPASS_TAXONOMIES.filter((taxonomy) => !mastered.has(taxonomy)),
    correctCount,
    totalCount: questions.length,
    latestAttemptId: null,
    matchedModuleIds: Array.from(matchedModuleIds),
  };
}

function isAnsweredCorrectly(answer: LearningAssessmentAnswerRaw, module: LearningModule): boolean {
  const question = module.theoreticalExam?.questions[answer.questionIndex];
  if (!question) return false;
  return answer.selectedIndex === question.correctIndex;
}

export function evaluateFoundationPretestFromAssessments(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
): FoundationPretestEvidence {
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const latestAttempt = latestPretestAttempt(assessments.attempts);
  if (!latestAttempt) {
    return {
      passed: false,
      masteredTaxonomies: [],
      missingTaxonomies: [...FOUNDATION_BYPASS_TAXONOMIES],
      correctCount: 0,
      totalCount: 0,
      latestAttemptId: null,
      matchedModuleIds: [],
    };
  }

  const answers = assessments.answers.filter((answer) => answer.attemptId === latestAttempt.id);
  const mastered = new Set<BloomTaxonomy>();
  const matchedModuleIds = new Set<string>();
  let correctCount = 0;

  for (const answer of answers) {
    if (answer.assessmentType !== 'pretest') continue;
    const module = moduleById.get(answer.moduleId);
    if (!module || !isFoundationModule(module)) continue;
    const taxonomy = answer.questionTaxonomy as BloomTaxonomy | null;
    if (!isFoundationTaxonomy(taxonomy)) continue;
    if (!isAnsweredCorrectly(answer, module)) continue;
    mastered.add(taxonomy);
    matchedModuleIds.add(module.id);
    correctCount += 1;
  }

  return {
    passed: FOUNDATION_BYPASS_TAXONOMIES.every((taxonomy) => mastered.has(taxonomy)),
    masteredTaxonomies: FOUNDATION_BYPASS_TAXONOMIES.filter((taxonomy) => mastered.has(taxonomy)),
    missingTaxonomies: FOUNDATION_BYPASS_TAXONOMIES.filter((taxonomy) => !mastered.has(taxonomy)),
    correctCount,
    totalCount: answers.length,
    latestAttemptId: latestAttempt.id,
    matchedModuleIds: Array.from(matchedModuleIds),
  };
}
