import { describe, expect, it } from 'vitest';
import {
  buildLearningAssessmentAnswerInputs,
  buildLearningAssessmentQuestions,
  evaluateFoundationPretest,
  hasLearningAssessmentAnswer,
  type LearningAssessmentQuestion,
} from '../learningAssessments';
import {
  LEARNING_MODULES,
  normalizeLearningModules,
  type BloomTaxonomy,
  type ExamQuestion,
  type LearningModule,
} from '../learningModules';

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

const BLOOM_PATHS: Record<'pretest' | 'posttest' | 'posttest2', BloomTaxonomy[]> = {
  pretest: [
    'remembering', 'remembering', 'remembering', 'remembering', 'remembering', 'remembering',
    'understanding', 'understanding', 'understanding', 'understanding', 'understanding', 'understanding',
    'applying', 'applying', 'applying', 'applying', 'applying', 'applying',
    'analyzing', 'analyzing', 'analyzing', 'analyzing', 'analyzing', 'analyzing',
    'evaluating', 'evaluating', 'evaluating', 'evaluating', 'evaluating', 'evaluating',
    'creating', 'creating', 'creating', 'creating', 'creating', 'creating',
  ],
  posttest: ['analyzing', 'evaluating', 'creating', 'analyzing', 'evaluating', 'creating', 'applying', 'analyzing'],
  posttest2: ['remembering', 'applying', 'analyzing', 'evaluating', 'creating', 'understanding', 'applying', 'evaluating'],
};

function stripQuestionTaxonomy(question: ExamQuestion): ExamQuestion {
  const { taxonomy: _taxonomy, ...rest } = question;
  return rest;
}

function stripModuleTaxonomy(module: LearningModule): LearningModule {
  return {
    ...module,
    theoreticalExam: module.theoreticalExam
      ? {
          ...module.theoreticalExam,
          questions: module.theoreticalExam.questions.map(stripQuestionTaxonomy),
        }
      : undefined,
    practicalExam: module.practicalExam
      ? {
          ...module.practicalExam,
          taxonomy: undefined,
        }
      : undefined,
  };
}

function collectTaxonomies(modules: ReadonlyArray<LearningModule>): BloomTaxonomy[] {
  const seen = new Set<BloomTaxonomy>();
  for (const module of modules) {
    for (const question of module.theoreticalExam?.questions ?? []) {
      if (question.taxonomy) seen.add(question.taxonomy);
    }
    if (module.practicalExam?.taxonomy) {
      seen.add(module.practicalExam.taxonomy);
    }
  }
  return Array.from(seen);
}

function buildCompactModuleBank(): LearningModule {
  return {
    id: 'compact-bank',
    category: 'creational',
    title: 'Compact Bank',
    eyebrow: 'Compact',
    intro: 'A compact module with one question for each Bloom taxonomy.',
    sections: [],
    theoreticalExam: {
      kind: 'theoretical',
      questions: BLOOM_LEVELS.map((taxonomy) => ({
        type: 'mcq',
        question: `${taxonomy} question`,
        options: ['A', 'B'],
        correctIndex: 0,
        taxonomy,
      })),
    },
  };
}

function buildQuestion(
  assessmentIndex: number,
  taxonomy: NonNullable<LearningAssessmentQuestion['taxonomy']>,
  correctIndex = 0,
): LearningAssessmentQuestion {
  return {
    assessmentType: 'pretest',
    assessmentIndex,
    moduleId: `foundations-${assessmentIndex}`,
    moduleTitle: `Module ${assessmentIndex}`,
    moduleEyebrow: 'Foundations',
    questionIndex: assessmentIndex,
    taxonomy,
    question: {
      type: 'mcq',
      question: `Question ${assessmentIndex}`,
      options: ['A', 'B'],
      correctIndex,
    },
  };
}

describe('learning module taxonomy normalization', () => {
  it('restores the runtime Bloom taxonomy set from API-shaped modules', () => {
    const apiShapedModules = LEARNING_MODULES.map(stripModuleTaxonomy);
    const normalized = normalizeLearningModules(apiShapedModules);
    expect(collectTaxonomies(normalized).sort()).toEqual(BLOOM_LEVELS.slice().sort());
  });
});

describe('buildLearningAssessmentQuestions', () => {
  it.each([
    ['pretest', BLOOM_PATHS.pretest],
    ['posttest', BLOOM_PATHS.posttest],
    ['posttest2', BLOOM_PATHS.posttest2],
  ] as const)('matches the %s Bloom path', (assessmentType, expectedPath) => {
    const questions = buildLearningAssessmentQuestions(
      LEARNING_MODULES.map(stripModuleTaxonomy),
      assessmentType,
    );
    expect(questions).toHaveLength(expectedPath.length);
    expect(questions.map((item) => item.taxonomy)).toEqual(expectedPath);
    expect(questions.map((item) => item.question.taxonomy)).toEqual(expectedPath);
  });

  it('reuses exact-taxonomy questions when the eligible module pool is compact', () => {
    const questions = buildLearningAssessmentQuestions([buildCompactModuleBank()], 'posttest');
    expect(questions).toHaveLength(BLOOM_PATHS.posttest.length);
    expect(questions.map((item) => item.taxonomy)).toEqual(BLOOM_PATHS.posttest);
    expect(questions.map((item) => item.question.taxonomy)).toEqual(BLOOM_PATHS.posttest);
  });
});

describe('evaluateFoundationPretest', () => {
  const questions = [
    buildQuestion(0, 'remembering'),
    buildQuestion(1, 'understanding'),
    buildQuestion(2, 'applying'),
  ];

  it('distinguishes the four foundation personas by mastery shape', () => {
    const personas = [
      {
        name: 'no knowledge',
        answers: { 0: 1, 1: 1, 2: 1 },
        passed: false,
        masteredTaxonomies: [],
        missingTaxonomies: ['remembering', 'understanding', 'applying'],
        correctCount: 0,
      },
      {
        name: 'fundamentals only',
        answers: { 0: 0, 1: 0, 2: 1 },
        passed: false,
        masteredTaxonomies: ['remembering', 'understanding'],
        missingTaxonomies: ['applying'],
        correctCount: 2,
      },
      {
        name: 'some knowledge',
        answers: { 0: 0, 1: 1, 2: 1 },
        passed: false,
        masteredTaxonomies: ['remembering'],
        missingTaxonomies: ['understanding', 'applying'],
        correctCount: 1,
      },
      {
        name: 'proficient',
        answers: { 0: 0, 1: 0, 2: 0 },
        passed: true,
        masteredTaxonomies: ['remembering', 'understanding', 'applying'],
        missingTaxonomies: [],
        correctCount: 3,
      },
    ] as const;

    for (const persona of personas) {
      const result = evaluateFoundationPretest(questions, persona.answers);
      expect(result.passed).toBe(persona.passed);
      expect(result.masteredTaxonomies).toEqual(persona.masteredTaxonomies);
      expect(result.missingTaxonomies).toEqual(persona.missingTaxonomies);
      expect(result.correctCount).toBe(persona.correctCount);
      expect(result.totalCount).toBe(3);
    }
  });
});

describe('assessment answer serialization', () => {
  it('recognizes answered MCQ, identification, and studio values', () => {
    const mcq = buildQuestion(0, 'remembering').question;
    const identification: ExamQuestion = {
      type: 'identification',
      question: 'Name the moving parts',
      scenario: 'A creator object selects a concrete product.',
      expectedTokens: ['creator', 'product'],
    };
    const studio: ExamQuestion = {
      type: 'studio',
      prompt: 'Detect the target pattern',
      targetPatternSlug: 'factory-method',
    };

    expect(hasLearningAssessmentAnswer(mcq, 0)).toBe(true);
    expect(hasLearningAssessmentAnswer(mcq, -1)).toBe(false);
    expect(hasLearningAssessmentAnswer(identification, ['creator', 'product'])).toBe(true);
    expect(hasLearningAssessmentAnswer(identification, ['creator', ''])).toBe(false);
    expect(hasLearningAssessmentAnswer(studio, true)).toBe(true);
    expect(hasLearningAssessmentAnswer(studio, false)).toBe(false);
  });

  it('serializes only actually answered questions', () => {
    const questions: LearningAssessmentQuestion[] = [
      buildQuestion(0, 'remembering'),
      {
        ...buildQuestion(1, 'understanding'),
        question: {
          type: 'identification',
          question: 'Identify roles',
          scenario: 'A subject notifies observers.',
          expectedTokens: ['subject', 'observer'],
        },
      },
      {
        ...buildQuestion(2, 'applying'),
        question: {
          type: 'studio',
          prompt: 'Run the analyzer',
          targetPatternSlug: 'observer',
        },
      },
      buildQuestion(3, 'analyzing'),
    ];

    const serialized = buildLearningAssessmentAnswerInputs(questions, {
      0: 1,
      1: ['subject', 'observer'],
      2: true,
    });

    expect(serialized).toEqual([
      expect.objectContaining({ moduleId: 'foundations-0', selectedIndex: 1, responseText: null }),
      expect.objectContaining({ moduleId: 'foundations-1', selectedIndex: -1, responseText: '["subject","observer"]' }),
      expect.objectContaining({ moduleId: 'foundations-2', selectedIndex: -1, responseText: 'true' }),
    ]);
    expect(serialized).toHaveLength(3);
    expect(serialized.some((answer) => answer.moduleId === 'foundations-3')).toBe(false);
  });
});
