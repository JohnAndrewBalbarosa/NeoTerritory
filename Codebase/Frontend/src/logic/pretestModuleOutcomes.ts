import type { LearningAssessmentsResponse } from '../types/api';
import {
  BLOOM_TAXONOMIES,
  isAnswerCorrect,
  type BloomTaxonomy,
  type ExamQuestion,
  type LearningModule,
} from '../data/learningModules';

export interface PretestModuleOutcome {
  masteredBloomLevels: BloomTaxonomy[];
  failed: boolean;
  exempt: boolean;
  perfect: boolean;
}

export interface PretestModuleOutcomes {
  latestAttemptId: number | null;
  masteredBloomLevelsByModuleId: Record<string, BloomTaxonomy[]>;
  bloomMasteryByModuleId: Record<string, number>;
  failedModuleIds: string[];
  exemptModuleIds: string[];
  perfectModuleIds: string[];
}

export function masteryLevelForBloomLevels(levels: ReadonlyArray<BloomTaxonomy>): number {
  const mastered = new Set(levels);
  let highestConsecutive = 0;
  for (const taxonomy of BLOOM_TAXONOMIES) {
    if (!mastered.has(taxonomy)) break;
    highestConsecutive += 1;
  }
  return highestConsecutive;
}

function toTime(value: string | undefined): number | null {
  if (!value) return null;
  const utcValue = value.includes('T') || value.includes('Z') ? value : `${value.replace(' ', 'T')}Z`;
  const time = new Date(utcValue).getTime();
  return Number.isFinite(time) ? time : null;
}

export function bloomLevelForTaxonomy(taxonomy: BloomTaxonomy | undefined | null): number {
  return taxonomy ? BLOOM_TAXONOMIES.indexOf(taxonomy) + 1 : 0;
}

export function bloomTaxonomiesThroughLevel(level: number): BloomTaxonomy[] {
  const ceiling = Math.max(0, Math.min(6, Math.floor(level)));
  return BLOOM_TAXONOMIES.slice(0, ceiling);
}

export function bloomMasteryFromTaxonomies(taxonomies: Iterable<BloomTaxonomy>): number {
  return masteryLevelForBloomLevels(Array.from(taxonomies));
}

function pretestQuestionsForModule(module: LearningModule): ReadonlyArray<ExamQuestion> {
  return module.assessmentForms?.A ?? module.theoreticalExam?.questions ?? [];
}

function questionForAnswer(module: LearningModule, answer: LearningAssessmentsResponse['answers'][number]): ExamQuestion | undefined {
  const questions = pretestQuestionsForModule(module);
  if (answer.questionId && module.assessmentForms?.A) {
    const byId = module.assessmentForms.A.find((question) => question.id === answer.questionId);
    if (byId) return byId;
  }
  return questions[answer.questionIndex];
}

function levelGroupsForQuestions(questions: ReadonlyArray<ExamQuestion>): Array<{ taxonomy: BloomTaxonomy; questions: ExamQuestion[] }> {
  const byTaxonomy = new Map<BloomTaxonomy, ExamQuestion>();
  for (const question of questions) {
    if (!question.taxonomy) continue;
    if (!byTaxonomy.has(question.taxonomy)) byTaxonomy.set(question.taxonomy, question);
  }
  return BLOOM_TAXONOMIES
    .filter((taxonomy) => byTaxonomy.has(taxonomy))
    .map((taxonomy) => ({ taxonomy, questions: [byTaxonomy.get(taxonomy)!] }));
}

function latestFreshPretestAttempt(assessments: LearningAssessmentsResponse): number | null {
  const courseUpdatedAt = toTime(assessments.courseUpdatedAt);
  const freshPretests = assessments.attempts.filter((attempt) => {
    if (attempt.assessmentType !== 'pretest') return false;
    if (attempt.questionCount <= 0) return false;
    const createdAt = toTime(attempt.createdAt);
    if (createdAt == null) return false;
    if (courseUpdatedAt != null && createdAt < courseUpdatedAt) return false;
    return assessments.answers.some((answer) => answer.attemptId === attempt.id);
  });

  if (freshPretests.length === 0) return null;

  freshPretests.sort((a, b) => {
    const timeCompare = String(a.createdAt).localeCompare(String(b.createdAt));
    if (timeCompare !== 0) return timeCompare;
    return a.id - b.id;
  });

  return freshPretests[freshPretests.length - 1]?.id ?? null;
}

export function derivePretestModuleOutcomes(
  modules: ReadonlyArray<LearningModule>,
  assessments: LearningAssessmentsResponse,
): PretestModuleOutcomes {
  const latestAttemptId = latestFreshPretestAttempt(assessments);
  if (latestAttemptId == null) {
    return {
      latestAttemptId: null,
      masteredBloomLevelsByModuleId: {},
      bloomMasteryByModuleId: {},
      failedModuleIds: [],
      exemptModuleIds: [],
      perfectModuleIds: [],
    };
  }

  const answers = assessments.answers.filter((answer) => answer.attemptId === latestAttemptId && answer.assessmentType === 'pretest');
  const answersByModuleId = new Map<string, typeof answers>();

  for (const answer of answers) {
    const existing = answersByModuleId.get(answer.moduleId);
    if (existing) {
      existing.push(answer);
    } else {
      answersByModuleId.set(answer.moduleId, [answer]);
    }
  }

  const masteredBloomLevelsByModuleId: Record<string, BloomTaxonomy[]> = {};
  const bloomMasteryByModuleId: Record<string, number> = {};
  const failedModuleIds: string[] = [];
  const exemptModuleIds: string[] = [];
  const perfectModuleIds: string[] = [];

  for (const module of modules) {
    const questions = pretestQuestionsForModule(module);
    if (questions.length === 0) continue;

    const moduleAnswers = answersByModuleId.get(module.id) ?? [];
    const answersByQuestion = new Map<ExamQuestion, typeof moduleAnswers[number]>();
    for (const answer of moduleAnswers) {
      const question = questionForAnswer(module, answer);
      if (question) answersByQuestion.set(question, answer);
    }
    const requiredTaxonomies = new Set(
      questions
        .map((question) => question.taxonomy)
        .filter((taxonomy): taxonomy is BloomTaxonomy => typeof taxonomy === 'string'),
    );
    const masteredLevels = new Set<BloomTaxonomy>();
    let hasIncorrectAnswer = false;

    for (const group of levelGroupsForQuestions(questions)) {
      const groupAnswers = group.questions.map((question) => answersByQuestion.get(question));
      if (groupAnswers.some((answer) => !answer)) break;

      const allCorrect = group.questions.every((question) => {
        const answer = answersByQuestion.get(question);
        if (!answer) return false;
        const userAnswer = question.type === 'mcq' ? answer.selectedIndex : answer.responseText;
        return isAnswerCorrect(question, userAnswer);
      });
      if (!allCorrect) {
        hasIncorrectAnswer = true;
        break;
      }

      masteredLevels.add(group.taxonomy);
    }

    const masteredBloomLevels = questions
      .map((question) => question.taxonomy)
      .filter((taxonomy): taxonomy is BloomTaxonomy => typeof taxonomy === 'string' && masteredLevels.has(taxonomy))
      .filter((taxonomy, index, list) => list.indexOf(taxonomy) === index);

    if (masteredBloomLevels.length > 0) {
      masteredBloomLevelsByModuleId[module.id] = masteredBloomLevels;
      bloomMasteryByModuleId[module.id] = bloomMasteryFromTaxonomies(masteredBloomLevels);
    }

    if (hasIncorrectAnswer) {
      failedModuleIds.push(module.id);
    }

    const allAvailableTaxonomiesCorrect =
      requiredTaxonomies.size > 0 &&
      Array.from(requiredTaxonomies).every((taxonomy) => masteredLevels.has(taxonomy)) &&
      !hasIncorrectAnswer;

    if (allAvailableTaxonomiesCorrect) {
      exemptModuleIds.push(module.id);
      perfectModuleIds.push(module.id);
      bloomMasteryByModuleId[module.id] = 6;
    }
  }

  return {
    latestAttemptId,
    masteredBloomLevelsByModuleId,
    bloomMasteryByModuleId,
    failedModuleIds,
    exemptModuleIds,
    perfectModuleIds,
  };
}
