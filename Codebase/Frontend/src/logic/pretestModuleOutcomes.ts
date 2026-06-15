import type { LearningAssessmentsResponse } from '../types/api';
import {
  isAnswerCorrect,
  type BloomTaxonomy,
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
  failedModuleIds: string[];
  exemptModuleIds: string[];
  perfectModuleIds: string[];
}

function toTime(value: string | undefined): number | null {
  if (!value) return null;
  const utcValue = value.includes('T') || value.includes('Z') ? value : `${value.replace(' ', 'T')}Z`;
  const time = new Date(utcValue).getTime();
  return Number.isFinite(time) ? time : null;
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
  const failedModuleIds: string[] = [];
  const exemptModuleIds: string[] = [];
  const perfectModuleIds: string[] = [];

  for (const module of modules) {
    const questions = module.theoreticalExam?.questions ?? [];
    if (questions.length === 0) continue;

    const moduleAnswers = answersByModuleId.get(module.id) ?? [];
    const requiredTaxonomies = new Set(
      questions
        .map((question) => question.taxonomy)
        .filter((taxonomy): taxonomy is BloomTaxonomy => typeof taxonomy === 'string'),
    );
    const masteredLevels = new Set<BloomTaxonomy>();
    let hasIncorrectAnswer = false;

    for (const answer of moduleAnswers) {
      const question = questions[answer.questionIndex];
      if (!question) continue;

      const userAnswer = question.type === 'mcq' ? answer.selectedIndex : answer.responseText;
      if (isAnswerCorrect(question, userAnswer)) {
        const taxonomy = question.taxonomy ?? answer.questionTaxonomy;
        if (taxonomy) masteredLevels.add(taxonomy);
      } else {
        hasIncorrectAnswer = true;
      }
    }

    const masteredBloomLevels = questions
      .map((question) => question.taxonomy)
      .filter((taxonomy): taxonomy is BloomTaxonomy => typeof taxonomy === 'string' && masteredLevels.has(taxonomy))
      .filter((taxonomy, index, list) => list.indexOf(taxonomy) === index);

    if (masteredBloomLevels.length > 0) {
      masteredBloomLevelsByModuleId[module.id] = masteredBloomLevels;
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
    }
  }

  return {
    latestAttemptId,
    masteredBloomLevelsByModuleId,
    failedModuleIds,
    exemptModuleIds,
    perfectModuleIds,
  };
}
