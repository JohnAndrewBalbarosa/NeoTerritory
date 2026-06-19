import type { LearningAssessmentAnswerRaw, LearningAssessmentAttemptRaw, LearningAssessmentsResponse } from '../types/api';
import {
  BLOOM_TAXONOMIES,
  FOUNDATION_BYPASS_TAXONOMIES,
  type BloomTaxonomy,
  type ExamQuestion,
  type LearningModule,
  normalizeLearningModules,
  isFoundationModule,
  isAnswerCorrect,
  isMcqQuestion,
  isIdentificationQuestion,
  isStudioQuestion,
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

function pickQuestionsForTaxonomy(module: LearningModule, taxonomy: BloomTaxonomy): Array<[ExamQuestion, number]> {
  const qs = module.theoreticalExam?.questions || [];
  const target = taxonomy.toLowerCase();
  return qs
    .map((q, i) => [q, i] as [ExamQuestion, number])
    .filter(([q]) => (q.taxonomy || '').toLowerCase() === target);
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
    const pickedSet = pickQuestionsForTaxonomy(module, taxonomy);
    return pickedSet.map((picked) => ({
      module,
      picked,
      questionKey: `${module.id}:${picked[1]}`,
    }));
  });
}

export interface LearningAssessmentAnswerInput {
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText?: string | null;
  questionTaxonomy?: BloomTaxonomy | null;
  questionKind?: 'theoretical' | 'practical';
}

export function hasLearningAssessmentAnswer(question: ExamQuestion, answer: unknown): boolean {
  if (isMcqQuestion(question)) {
    return typeof answer === 'number' && Number.isInteger(answer) && answer >= 0;
  }
  if (isIdentificationQuestion(question)) {
    if (Array.isArray(answer)) {
      // Must have exactly as many non-empty answers as expected tokens.
      return answer.length === question.expectedTokens.length && answer.every((token) => typeof token === 'string' && token.trim().length > 0);
    }
    return typeof answer === 'string' && answer.trim().length > 0;
  }
  if (isStudioQuestion(question)) {
    return answer === true;
  }
  return false;
}

function serializeAssessmentResponse(question: ExamQuestion, answer: unknown): string | null {
  if (isIdentificationQuestion(question)) {
    if (Array.isArray(answer)) {
      return JSON.stringify(answer);
    }
    return typeof answer === 'string' && answer.trim().length > 0 ? answer : null;
  }
  if (isStudioQuestion(question)) {
    return answer === true ? 'true' : null;
  }
  return typeof answer === 'string' ? answer : null;
}

export function buildLearningAssessmentAnswerInputs(
  questions: ReadonlyArray<LearningAssessmentQuestion>,
  answers: Record<number, unknown>,
): LearningAssessmentAnswerInput[] {
  return questions
    .map((question) => {
      const answer = answers[question.assessmentIndex];
      return {
        moduleId: question.moduleId,
        questionIndex: question.questionIndex,
        selectedIndex: typeof answer === 'number' ? answer : -1,
        responseText: serializeAssessmentResponse(question.question, answer),
        questionTaxonomy: question.taxonomy,
        questionKind: 'theoretical' as const,
      };
    });
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
      'This baseline uses the published Modern C++ pattern bank. The server validates every submitted answer, including unanswered items.',
    submitLabel: 'Finish Pre-test & Start Learning',
    continueLabel: 'Continue to Learning Path',
    nextPath: '/patterns/learn',
  },
  posttest: {
    eyebrow: 'Learning outcome',
    badge: 'POST',
    title: 'Post-Test',
    intro:
      'This checkpoint samples later module questions and uses server-validated scoring.',
    submitLabel: 'Save Post-test',
    continueLabel: 'Continue to Post-Test 2',
    nextPath: '/post-test-2',
  },
  posttest2: {
    eyebrow: 'Learning outcome',
    badge: 'POST 2',
    title: 'Post-Test, Part 2',
    intro:
      'This follow-up checkpoint reuses module questions with a different slice and uses server-validated scoring.',
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
  const eligible = normalizedModules.filter((module) => module.theoreticalExam?.questions.length);

  if (assessmentType === 'practical') return [];

  if (assessmentType === 'pretest' || assessmentType === 'posttest' || assessmentType === 'posttest2') {
    const questions: Omit<LearningAssessmentQuestion, 'assessmentIndex'>[] = [];
    const taxonomies: ReadonlyArray<BloomTaxonomy> =
      assessmentType === 'pretest'
        ? BLOOM_TAXONOMIES
        : [assessmentType === 'posttest' ? 'evaluating' : 'creating'];

    for (const taxonomy of taxonomies) {
      for (const module of eligible) {
        const candidates = collectQuestionCandidates([module], taxonomy);
        if (candidates.length > 0) {
          const shuffledCandidates = seededShuffle(candidates, `${assessmentType}:${module.id}:${taxonomy}`);
          const candidate = shuffledCandidates[0];

          questions.push({
            assessmentType,
            moduleId: module.id,
            moduleTitle: module.title,
            moduleEyebrow: module.eyebrow,
            questionIndex: candidate.picked[1],
            question: candidate.picked[0],
            taxonomy,
          });
        }
      }
    }

    const shuffledQuestions = seededShuffle(questions, `${assessmentType}:final-shuffle`);

    return shuffledQuestions.map((q, index) => ({
      ...q,
      assessmentIndex: index,
    }));
  }

  return [];
}

// ---------------------------------------------------------------------------
// Revised objective assessment model (assessment-presentation revision).
//
// Pre-test and post-test share ONE objective question pool per module so the
// two are directly comparable for learning-gain measurement. Bloom taxonomy is
// internal metadata only and never controls ordering or weighting here.
//
// Exclusions from the objective test:
//   - studio (produce-code) questions: Creating ability is measured by the
//     separate practical activity, NOT the objective MCQ percentage.
//   - any objective (MCQ/identification) item mis-tagged as 'creating': naming
//     or recognising a pattern is not a Creating task, so it is dropped from
//     the formal objective test to keep the instrument clean.
// ---------------------------------------------------------------------------

export const PROFICIENCY_THRESHOLD = 80;
export const OBJECTIVE_QUESTIONS_PER_MODULE = 5;

export function isObjectiveExamQuestion(question: ExamQuestion): boolean {
  return isMcqQuestion(question) || isIdentificationQuestion(question);
}

// Generated-fallback templates that reveal their own answer (the scenario names
// the module and the expected token is the module name). They assess recall at
// best, never genuine Applying/Analyzing/Evaluating, so they must not enter the
// formal objective assessment.
const ANSWER_REVEALING_TEMPLATES: ReadonlyArray<RegExp> = [
  /identify the design idea suggested by the scenario/i,
  /must apply the .* module to a small c\+\+ design exercise/i,
  /name the design idea a learner should create/i,
];

// True when an item gives its own answer away — either it matches a known
// answer-revealing template, or it is an identification question whose expected
// token already appears verbatim in the prompt/scenario.
export function isAnswerRevealingQuestion(question: ExamQuestion): boolean {
  const text = [
    (question as { question?: string }).question ?? '',
    (question as { scenario?: string }).scenario ?? '',
    (question as { prompt?: string }).prompt ?? '',
  ].join(' ');
  if (ANSWER_REVEALING_TEMPLATES.some((re) => re.test(text))) return true;
  if (isIdentificationQuestion(question)) {
    const hay = text.toLowerCase();
    if (question.expectedTokens.some((token) => token && hay.includes(String(token).toLowerCase()))) {
      return true;
    }
  }
  return false;
}

// True when a question may appear on the formal objective pre/post-test.
export function isEligibleObjectiveQuestion(question: ExamQuestion): boolean {
  if (!isObjectiveExamQuestion(question)) return false; // excludes studio
  if ((question.taxonomy || '').toLowerCase() === 'creating') return false; // mis-tagged objective
  if (isAnswerRevealingQuestion(question)) return false; // answer-revealing / templated fallback
  return true;
}

export function eligibleObjectiveQuestions(module: LearningModule): Array<[ExamQuestion, number]> {
  const qs = module.theoreticalExam?.questions || [];
  return qs
    .map((q, i) => [q, i] as [ExamQuestion, number])
    .filter(([q]) => isEligibleObjectiveQuestion(q));
}

// Build a flat, mixed, paginated-friendly objective assessment. The same module
// set and per-module question count are used for every objective assessment
// type (pretest/posttest/posttest2) so pre vs post are comparable. The bank has
// no parallel alternates, so pre/post reuse the same questions in a different
// mixed order.
export function buildObjectiveAssessment(
  modules: ReadonlyArray<LearningModule>,
  assessmentType: LearningAssessmentType,
): LearningAssessmentQuestion[] {
  const normalizedModules = normalizeLearningModules(modules);

  const perModule = normalizedModules
    .map((module) => {
      const eligible = eligibleObjectiveQuestions(module);
      if (eligible.length === 0) return null;
      // Stable, deterministic per-module selection (identical for pre & post),
      // capped so every module contributes the same number of questions.
      const picked = seededShuffle(eligible, `objective:${module.id}`)
        .slice(0, OBJECTIVE_QUESTIONS_PER_MODULE)
        .sort((a, b) => a[1] - b[1]);
      return { module, picked };
    })
    .filter((entry): entry is { module: LearningModule; picked: Array<[ExamQuestion, number]> } => entry !== null);

  // Round-robin across modules so consecutive questions come from different
  // modules (and therefore generally different Bloom levels) — a mixed but
  // controlled order rather than module-by-module or level-by-level blocks.
  const moduleOrder = seededShuffle(perModule, `${assessmentType}:module-order`);
  const queues = moduleOrder.map((entry) => ({ module: entry.module, items: [...entry.picked] }));
  const ordered: Omit<LearningAssessmentQuestion, 'assessmentIndex'>[] = [];
  let remaining = queues.reduce((sum, q) => sum + q.items.length, 0);
  while (remaining > 0) {
    for (const queue of queues) {
      const next = queue.items.shift();
      if (!next) continue;
      remaining -= 1;
      ordered.push({
        assessmentType,
        moduleId: queue.module.id,
        moduleTitle: queue.module.title,
        moduleEyebrow: queue.module.eyebrow,
        questionIndex: next[1],
        question: next[0],
        taxonomy: (next[0].taxonomy || 'remembering') as BloomTaxonomy,
      });
    }
  }
  return ordered.map((q, index) => ({ ...q, assessmentIndex: index }));
}

// Per-module and overall score. Every objective question is worth one point;
// unanswered questions count as incorrect and remain in the denominator.
export interface ModuleScore {
  moduleId: string;
  moduleTitle: string;
  correct: number;
  total: number;
  percent: number;
}
export interface AssessmentScore {
  correct: number;
  total: number;
  percent: number;
  byModule: Record<string, ModuleScore>;
}

export function scoreLearningAssessment(
  questions: ReadonlyArray<LearningAssessmentQuestion>,
  answers: Record<number, any>,
): AssessmentScore {
  const byModule: Record<string, ModuleScore> = {};
  let correct = 0;
  for (const item of questions) {
    const selected = answers[item.assessmentIndex];
    const answered = hasLearningAssessmentAnswer(item.question, selected);
    const ok = answered && isAnswerCorrect(item.question, selected);
    if (ok) correct += 1;
    const moduleScore =
      byModule[item.moduleId] ||
      (byModule[item.moduleId] = {
        moduleId: item.moduleId,
        moduleTitle: item.moduleTitle,
        correct: 0,
        total: 0,
        percent: 0,
      });
    moduleScore.total += 1;
    if (ok) moduleScore.correct += 1;
  }
  const total = questions.length;
  for (const moduleScore of Object.values(byModule)) {
    moduleScore.percent = moduleScore.total > 0 ? Math.round((moduleScore.correct / moduleScore.total) * 100) : 0;
  }
  return {
    correct,
    total,
    percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    byModule,
  };
}

// Pre-test module status. 'proficient' (>= 80%) does NOT mean 'completed' — a
// learner can be proficient on the baseline without doing the lesson/quiz.
export type ModuleProficiencyStatus = 'proficient' | 'recommended';
export function moduleProficiencyStatus(percent: number): ModuleProficiencyStatus {
  return percent >= PROFICIENCY_THRESHOLD ? 'proficient' : 'recommended';
}

// Learning gain is reported in PERCENTAGE POINTS (post - pre), never as a
// percent increase. A zero gain on an already-proficient module is "maintained
// proficiency", not a negative result.
export interface ModuleGain {
  moduleId: string;
  moduleTitle: string;
  prePercent: number;
  postPercent: number;
  gainPoints: number;
  maintained: boolean;
}
export interface LearningGain {
  prePercent: number;
  postPercent: number;
  gainPoints: number;
  maintained: boolean;
  byModule: ModuleGain[];
}

export function computeLearningGain(pre: AssessmentScore, post: AssessmentScore): LearningGain {
  const moduleIds = new Set<string>([...Object.keys(pre.byModule), ...Object.keys(post.byModule)]);
  const byModule: ModuleGain[] = Array.from(moduleIds).map((id) => {
    const preModule = pre.byModule[id];
    const postModule = post.byModule[id];
    const prePercent = preModule?.percent ?? 0;
    const postPercent = postModule?.percent ?? 0;
    const gainPoints = postPercent - prePercent;
    return {
      moduleId: id,
      moduleTitle: postModule?.moduleTitle ?? preModule?.moduleTitle ?? id,
      prePercent,
      postPercent,
      gainPoints,
      maintained: gainPoints === 0 && prePercent >= PROFICIENCY_THRESHOLD,
    };
  });
  const gainPoints = post.percent - pre.percent;
  return {
    prePercent: pre.percent,
    postPercent: post.percent,
    gainPoints,
    maintained: gainPoints === 0 && pre.percent >= PROFICIENCY_THRESHOLD,
    byModule,
  };
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
  answers: Record<number, any>,
): {
  results: LearningAssessmentResult[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
} {
  const results = questions.map((item) => {
    const selected = answers[item.assessmentIndex];
    const isCorrect = isAnswerCorrect(item.question, selected);
    // For legacy reasons we still return correctIndex if it's MCQ, otherwise -1
    const correctIndex = 'correctIndex' in item.question ? item.question.correctIndex : -1;
    // selectedIndex is also legacy for MCQ
    const selectedIndex = typeof selected === 'number' ? selected : null;

    return {
      assessmentIndex: item.assessmentIndex,
      moduleId: item.moduleId,
      questionIndex: item.questionIndex,
      correctIndex,
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

function latestPretestAttempt(
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>,
  courseUpdatedAt?: string,
): LearningAssessmentAttemptRaw | null {
  const pretests = attempts.filter((attempt) => {
    if (attempt.assessmentType !== 'pretest') return false;
    if (courseUpdatedAt && new Date(attempt.createdAt) < new Date(courseUpdatedAt)) return false;
    return true;
  });
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
  answers: Record<number, any>,
): FoundationPretestEvidence {
  const mastered = new Set<BloomTaxonomy>();
  const matchedModuleIds = new Set<string>();
  let correctCount = 0;

  for (const item of questions) {
    const selected = answers[item.assessmentIndex];
    const isCorrect = isAnswerCorrect(item.question, selected);
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

function latestAttemptOfType(
  attempts: ReadonlyArray<LearningAssessmentAttemptRaw>,
  assessmentType: LearningAssessmentType,
  courseUpdatedAt?: string,
): LearningAssessmentAttemptRaw | null {
  const matching = attempts.filter((attempt) => {
    if (attempt.assessmentType !== assessmentType) return false;
    if (courseUpdatedAt && new Date(attempt.createdAt) < new Date(courseUpdatedAt)) return false;
    return true;
  });
  if (matching.length === 0) return null;
  const sorted = [...matching].sort((a, b) => {
    const timeCompare = String(a.createdAt).localeCompare(String(b.createdAt));
    if (timeCompare !== 0) return timeCompare;
    return a.id - b.id;
  });
  return sorted[sorted.length - 1] ?? null;
}

// Re-grade the learner's latest stored attempt of a given objective assessment
// type. The assigned question set is rebuilt deterministically (so the
// denominator includes questions the learner skipped), and stored raw answers
// are graded against it. Returns null when there is no usable attempt.
export function scoreStoredObjectiveAssessment(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
  assessmentType: LearningAssessmentType,
): AssessmentScore | null {
  const attempt = latestAttemptOfType(assessments.attempts, assessmentType, assessments.courseUpdatedAt);
  if (!attempt) return null;

  const assigned = buildObjectiveAssessment(modules, assessmentType);
  if (assigned.length === 0) return null;

  const storedByKey = new Map<string, LearningAssessmentAnswerRaw>();
  for (const answer of assessments.answers) {
    if (answer.attemptId !== attempt.id) continue;
    storedByKey.set(`${answer.moduleId}:${answer.questionIndex}`, answer);
  }

  const answersByIndex: Record<number, any> = {};
  for (const item of assigned) {
    const stored = storedByKey.get(`${item.moduleId}:${item.questionIndex}`);
    if (!stored) continue; // skipped/unanswered -> graded as incorrect by scoreLearningAssessment
    answersByIndex[item.assessmentIndex] =
      item.question.type === 'mcq' ? stored.selectedIndex : stored.responseText;
  }

  return scoreLearningAssessment(assigned, answersByIndex);
}

function isAnsweredCorrectly(answer: LearningAssessmentAnswerRaw, module: LearningModule): boolean {
  if (typeof answer.isCorrect === 'boolean') return answer.isCorrect;
  const question = module.theoreticalExam?.questions[answer.questionIndex];
  if (!question) return false;
  // identification questions might store responseText instead of selectedIndex
  const userAnswer = question.type === 'mcq' ? answer.selectedIndex : answer.responseText;
  return isAnswerCorrect(question, userAnswer);
}

export function evaluateFoundationPretestFromAssessments(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
): FoundationPretestEvidence {
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const latestAttempt = latestPretestAttempt(assessments.attempts, assessments.courseUpdatedAt);
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
