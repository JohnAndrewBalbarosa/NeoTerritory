import { describe, expect, it } from 'vitest';
import {
  buildLearningAssessmentAnswerInputs,
  buildLearningAssessmentQuestions,
  buildFormalAssessment,
  buildObjectiveAssessment,
  computeLearningGain,
  evaluateFoundationPretest,
  hasLearningAssessmentAnswer,
  isAnswerRevealingQuestion,
  isEligibleObjectiveQuestion,
  moduleProficiencyStatus,
  scoreLearningAssessment,
  scoreStoredObjectiveAssessment,
  scoreStoredObjectiveAssessmentForCycle,
  type LearningAssessmentQuestion,
} from '../learningAssessments';
import type {
  LearningAssessmentsResponse,
  LearningAssessmentAnswerRaw,
} from '../../types/api';
import {
  LEARNING_MODULES,
  normalizeLearningModules,
  type BloomTaxonomy,
  type ExamQuestion,
  type LearningModule,
  type ObjectiveAssessmentQuestion,
  type AssessmentForms,
} from '../learningModules';
import {
  applicableObjectiveLevelsForModule,
  applicableBloomTaxonomiesForModule,
} from '../assessmentBanks/inventory';

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

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

function expectedModuleTaxonomyBuckets(modules: ReadonlyArray<LearningModule>): string[] {
  return normalizeLearningModules(modules)
    .flatMap((module) => Array.from(new Set(
      (module.theoreticalExam?.questions ?? [])
        .map((question) => question.taxonomy)
        .filter((taxonomy): taxonomy is BloomTaxonomy => typeof taxonomy === 'string'),
    )).map((taxonomy) => `${module.id}:${taxonomy}`))
    .sort();
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
  it('emits one exact Bloom bucket per eligible module for each pretest level', () => {
    const modules = LEARNING_MODULES.map(stripModuleTaxonomy);
    const questions = buildLearningAssessmentQuestions(
      modules,
      'pretest',
    );
    expect(questions.map((item) => `${item.moduleId}:${item.taxonomy}`).sort()).toEqual(
      expectedModuleTaxonomyBuckets(modules),
    );
    expect(questions.every((item) => item.assessmentType === 'pretest')).toBe(true);
    expect(questions.every((item) => item.question.taxonomy === item.taxonomy)).toBe(true);
    expect(new Set(questions.map((item) => item.assessmentIndex)).size).toBe(questions.length);
  });

  it.each([
    ['posttest', 'evaluating'],
    ['posttest2', 'creating'],
  ] as const)('emits one question per eligible module for %s', (assessmentType, expectedTaxonomy) => {
    const modules = LEARNING_MODULES.map(stripModuleTaxonomy);
    const eligible = normalizeLearningModules(modules).filter((module) => module.theoreticalExam?.questions.length);
    const questions = buildLearningAssessmentQuestions(modules, assessmentType);
    expect(questions).toHaveLength(eligible.length);
    expect(new Set(questions.map((item) => item.moduleId))).toEqual(new Set(eligible.map((module) => module.id)));
    expect(questions.every((item) => item.taxonomy === expectedTaxonomy)).toBe(true);
    expect(questions.every((item) => item.question.taxonomy === item.taxonomy)).toBe(true);
  });

  it('uses each Bloom taxonomy once when the eligible module pool is compact in pretest mode', () => {
    const questions = buildLearningAssessmentQuestions([buildCompactModuleBank()], 'pretest');
    expect(questions).toHaveLength(BLOOM_LEVELS.length);
    expect(questions.map((item) => item.taxonomy).sort()).toEqual(BLOOM_LEVELS.slice().sort());
    expect(questions.every((item) => item.question.taxonomy === item.taxonomy)).toBe(true);
  });

  it('normalizes sparse module banks to six Bloom-level pretest questions', () => {
    const sparseModule: LearningModule = {
      ...buildCompactModuleBank(),
      id: 'sparse-bank',
      theoreticalExam: {
        kind: 'theoretical',
        questions: buildCompactModuleBank().theoreticalExam!.questions.slice(0, 2),
      },
    };

    const questions = buildLearningAssessmentQuestions([sparseModule], 'pretest');
    expect(questions).toHaveLength(6);
    expect(questions.map((item) => item.taxonomy).sort()).toEqual(BLOOM_LEVELS.slice().sort());
    expect(questions.every((item) => item.moduleId === 'sparse-bank')).toBe(true);
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

// Note: normalizeLearningModules() forces every module to exactly six
// questions (one per Bloom level). The compact bank therefore yields 5
// objective questions after the creating level is excluded, all MCQ with
// correctIndex 0 — a predictable fixture for scoring/gain assertions.

describe('isAnswerRevealingQuestion', () => {
  it('flags the generated fallback identification templates', () => {
    const fallbackApply: ExamQuestion = {
      type: 'identification',
      taxonomy: 'applying',
      question: 'Identify the design idea suggested by the scenario.',
      scenario: 'A learner must apply the Builder module to a small C++ design exercise.',
      expectedTokens: ['builder'],
    };
    expect(isAnswerRevealingQuestion(fallbackApply)).toBe(true);
    expect(isEligibleObjectiveQuestion(fallbackApply)).toBe(false);
  });

  it('flags identification whose expected token is visible in the prompt', () => {
    const visible: ExamQuestion = {
      type: 'identification',
      taxonomy: 'analyzing',
      question: 'Which pattern does this Adapter-style wrapper show?',
      scenario: 'A class wraps an incompatible interface.',
      expectedTokens: ['adapter'],
    };
    expect(isAnswerRevealingQuestion(visible)).toBe(true);
  });

  it('does not flag a genuine scenario-based MCQ that never names the answer', () => {
    const genuine: ExamQuestion = {
      type: 'mcq',
      taxonomy: 'applying',
      question: 'A system must build complex objects step by step with different final representations. Which pattern fits?',
      options: ['Builder', 'Singleton', 'Adapter', 'Observer'],
      correctIndex: 0,
    };
    expect(isAnswerRevealingQuestion(genuine)).toBe(false);
    expect(isEligibleObjectiveQuestion(genuine)).toBe(true);
  });

  it('keeps the real module bank free of answer-revealing items in the objective pool', () => {
    const built = buildObjectiveAssessment(LEARNING_MODULES, 'pretest');
    expect(built.length).toBeGreaterThan(0);
    expect(built.every((q) => !isAnswerRevealingQuestion(q.question))).toBe(true);
  });
});

describe('buildFormalAssessment (Form A / Form B pilot)', () => {
  const PILOT = ['foundations-what-is-pattern', 'creational-builder'];

  it('pre-test draws Form A only from modules that have authored forms (scoped, not all published)', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    // Only modules with an authored Form A appear (a growing subset, NOT all 40).
    expect(pre.length).toBeGreaterThan(0);
    expect(pre.length).toBeLessThan(40 * 5); // never "all published"
    const modules = new Set(pre.map((q) => q.moduleId));
    PILOT.forEach((id) => expect(modules.has(id)).toBe(true)); // pilots always included
    expect(pre.every((q) => typeof q.questionId === 'string' && q.questionId.includes(':A'))).toBe(true);
  });

  it('post-test draws Form B with same module set and zero exact-question overlap vs Form A', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const post = buildFormalAssessment(LEARNING_MODULES, 'posttest');
    expect(post.length).toBe(pre.length);
    expect(new Set(post.map((q) => q.moduleId))).toEqual(new Set(pre.map((q) => q.moduleId)));
    const aIds = new Set(pre.map((q) => q.questionId));
    expect(post.filter((q) => aIds.has(q.questionId))).toHaveLength(0);
  });

  it('an optional learner-plan scope further limits the modules assessed', () => {
    const scoped = buildFormalAssessment(LEARNING_MODULES, 'pretest', ['creational-builder']);
    expect(new Set(scoped.map((q) => q.moduleId))).toEqual(new Set(['creational-builder']));
    expect(scoped).toHaveLength(5);
  });

  it('correct-answer positions are not all the first option', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const positions = new Set(
      pre.map((q) => (q.question.type === 'mcq' ? q.question.correctIndex : -1)),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('generatedFallback exclusion', () => {
  it('excludes flag-marked fallbacks regardless of how clean the text looks', () => {
    const flagged: ExamQuestion = {
      type: 'mcq',
      taxonomy: 'remembering',
      question: 'A perfectly reasonable looking question?',
      options: ['A', 'B'],
      correctIndex: 0,
      generatedFallback: true,
    };
    expect(isEligibleObjectiveQuestion(flagged)).toBe(false);
  });

  it('the real objective pool contains no generated fallbacks and carries stable ids', () => {
    const built = buildObjectiveAssessment(LEARNING_MODULES, 'pretest');
    expect(built.every((q) => !q.question.generatedFallback)).toBe(true);
    expect(built.every((q) => typeof q.questionId === 'string' && q.questionId.length > 0)).toBe(true);
  });
});

describe('buildObjectiveAssessment', () => {
  it('excludes the creating level and any studio questions', () => {
    const built = buildObjectiveAssessment([buildCompactModuleBank()], 'pretest');
    expect(built).toHaveLength(5); // 6 Bloom levels minus creating
    expect(built.every((q) => (q.question.taxonomy || '') !== 'creating')).toBe(true);
    expect(built.every((q) => q.question.type !== 'studio')).toBe(true);
    expect(new Set(built.map((q) => q.assessmentIndex)).size).toBe(built.length);
  });

  it('never surfaces studio or creating-tagged items from the real module bank', () => {
    const built = buildObjectiveAssessment(LEARNING_MODULES, 'pretest');
    expect(built.length).toBeGreaterThan(0);
    expect(built.every((q) => q.question.type !== 'studio')).toBe(true);
    expect(built.every((q) => (q.question.taxonomy || '') !== 'creating')).toBe(true);
  });

  it('covers the same modules and per-module counts for pre-test and post-test', () => {
    const pre = buildObjectiveAssessment(LEARNING_MODULES, 'pretest');
    const post = buildObjectiveAssessment(LEARNING_MODULES, 'posttest');
    const byModule = (qs: LearningAssessmentQuestion[]) => {
      const map: Record<string, number> = {};
      qs.forEach((q) => { map[q.moduleId] = (map[q.moduleId] ?? 0) + 1; });
      return map;
    };
    expect(byModule(pre)).toEqual(byModule(post));
  });
});

describe('scoreLearningAssessment', () => {
  const questions = buildObjectiveAssessment([buildCompactModuleBank()], 'pretest'); // 5 MCQ, correctIndex 0

  it('scores overall and per-module with all answered correctly', () => {
    const score = scoreLearningAssessment(questions, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    expect(score.correct).toBe(5);
    expect(score.total).toBe(5);
    expect(score.percent).toBe(100);
    expect(score.byModule['compact-bank']).toMatchObject({ correct: 5, total: 5, percent: 100 });
  });

  it('counts unanswered questions as incorrect but keeps them in the denominator', () => {
    const score = scoreLearningAssessment(questions, { 0: 0, 1: 0, 2: 0, 3: 0 }); // index 4 unanswered
    expect(score.total).toBe(5);
    expect(score.correct).toBe(4);
    expect(score.percent).toBe(80);
    expect(score.byModule['compact-bank'].total).toBe(5);
  });
});

describe('moduleProficiencyStatus', () => {
  it('uses an 80% threshold (>=80 proficient, <80 recommended)', () => {
    expect(moduleProficiencyStatus(100)).toBe('proficient');
    expect(moduleProficiencyStatus(80)).toBe('proficient');
    expect(moduleProficiencyStatus(79)).toBe('recommended');
    expect(moduleProficiencyStatus(60)).toBe('recommended');
  });
});

describe('computeLearningGain', () => {
  const questions = buildObjectiveAssessment([buildCompactModuleBank()], 'pretest');

  it('reports gain in percentage points (post - pre)', () => {
    const pre = scoreLearningAssessment(questions, { 0: 0 }); // 1/5 = 20%
    const post = scoreLearningAssessment(questions, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }); // 100%
    const gain = computeLearningGain(pre, post);
    expect(gain.prePercent).toBe(20);
    expect(gain.postPercent).toBe(100);
    expect(gain.gainPoints).toBe(80);
    expect(gain.byModule[0]).toMatchObject({ moduleId: 'compact-bank', gainPoints: 80 });
  });

  it('treats an unchanged already-proficient score as maintained proficiency, not a negative', () => {
    const perfect = scoreLearningAssessment(questions, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    const gain = computeLearningGain(perfect, perfect);
    expect(gain.gainPoints).toBe(0);
    expect(gain.maintained).toBe(true);
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

// ---------------------------------------------------------------------------
// Bloom ceiling helpers
// ---------------------------------------------------------------------------

describe('applicableObjectiveLevelsForModule / applicableBloomTaxonomiesForModule', () => {
  it('non-foundation module returns all five objective levels', () => {
    const nonFoundation: Pick<LearningModule, 'id' | 'category'> = {
      id: 'creational-builder',
      category: 'creational',
    };
    const levels = applicableObjectiveLevelsForModule(nonFoundation);
    expect(levels).toEqual(['remember', 'understand', 'apply', 'analyze', 'evaluate']);
    const taxonomies = applicableBloomTaxonomiesForModule(nonFoundation);
    expect(taxonomies).toEqual(['remembering', 'understanding', 'applying', 'analyzing', 'evaluating']);
  });

  it('foundations-categories returns only remember/understand (narrowest ceiling)', () => {
    const m: Pick<LearningModule, 'id' | 'category'> = { id: 'foundations-categories', category: 'foundations' };
    expect(applicableObjectiveLevelsForModule(m)).toEqual(['remember', 'understand']);
    expect(applicableBloomTaxonomiesForModule(m)).toEqual(['remembering', 'understanding']);
  });

  it('foundations-what-is-pattern returns remember/understand/apply', () => {
    const m: Pick<LearningModule, 'id' | 'category'> = { id: 'foundations-what-is-pattern', category: 'foundations' };
    expect(applicableObjectiveLevelsForModule(m)).toEqual(['remember', 'understand', 'apply']);
    expect(applicableBloomTaxonomiesForModule(m)).toEqual(['remembering', 'understanding', 'applying']);
  });

  it('unknown foundation module defaults to remember/understand', () => {
    const m: Pick<LearningModule, 'id' | 'category'> = { id: 'foundations-unknown-new', category: 'foundations' };
    expect(applicableObjectiveLevelsForModule(m)).toEqual(['remember', 'understand']);
  });

  it('never includes creating in any result', () => {
    for (const module of LEARNING_MODULES) {
      const levels = applicableObjectiveLevelsForModule(module);
      const taxonomies = applicableBloomTaxonomiesForModule(module);
      expect(levels).not.toContain('create');
      expect(taxonomies).not.toContain('creating');
    }
  });
});

// ---------------------------------------------------------------------------
// buildFormalAssessment — Bloom ceiling enforcement
// ---------------------------------------------------------------------------

describe('buildFormalAssessment — Bloom ceiling enforcement', () => {
  // Build a synthetic foundation module fixture with items that intentionally
  // include high-Bloom levels above the ceiling, to verify they are dropped.
  // IMPORTANT: uses a fabricated module id NOT in ASSESSMENT_FORMS so that
  // normalizeLearningModule does not replace assessmentForms with real bank data.
  function makeFoundationModuleWithHighItems(): LearningModule {
    const validItems: ReadonlyArray<ObjectiveAssessmentQuestion> = [
      {
        id: 'syn-ceiling-test:A1', form: 'A', pairedQuestionId: 'syn-ceiling-test:B1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember',
        question: 'Recall question', options: ['a', 'b', 'c', 'd'], correctIndex: 0,
      },
      {
        id: 'syn-ceiling-test:A2', form: 'A', pairedQuestionId: 'syn-ceiling-test:B2',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand',
        question: 'Understand question', options: ['a', 'b', 'c', 'd'], correctIndex: 1,
      },
      // The three items below exceed the ceiling ['remember','understand'] for
      // any foundation module without an override entry — they must be dropped.
      {
        id: 'syn-ceiling-test:A3', form: 'A', pairedQuestionId: 'syn-ceiling-test:B3',
        type: 'mcq', taxonomy: 'applying', bloomLevel: 'apply',
        question: 'Apply question (above ceiling)', options: ['a', 'b', 'c', 'd'], correctIndex: 2,
      },
      {
        id: 'syn-ceiling-test:A4', form: 'A', pairedQuestionId: 'syn-ceiling-test:B4',
        type: 'mcq', taxonomy: 'analyzing', bloomLevel: 'analyze',
        question: 'Analyze question (above ceiling)', options: ['a', 'b', 'c', 'd'], correctIndex: 0,
      },
      {
        id: 'syn-ceiling-test:A5', form: 'A', pairedQuestionId: 'syn-ceiling-test:B5',
        type: 'mcq', taxonomy: 'evaluating', bloomLevel: 'evaluate',
        question: 'Evaluate question (above ceiling)', options: ['a', 'b', 'c', 'd'], correctIndex: 1,
      },
    ];
    const pairedItems: ReadonlyArray<ObjectiveAssessmentQuestion> = validItems.map((q) => ({
      ...q,
      id: q.id.replace(':A', ':B'),
      form: 'B' as const,
      pairedQuestionId: q.id,
      question: q.question + ' (paired)',
    }));
    const assessmentForms: AssessmentForms = { A: validItems, B: pairedItems };
    return {
      // 'foundations-ceiling-test-fixture' does NOT appear in ASSESSMENT_FORMS,
      // so normalizeLearningModule leaves assessmentForms intact (the fixture's own items).
      // The category is 'foundations' and the id is not in FOUNDATION_LEVEL_OVERRIDES,
      // so ceiling defaults to ['remember','understand'] — 3 items must be dropped.
      id: 'foundations-ceiling-test-fixture',
      category: 'foundations',
      title: 'Synthetic Foundation Ceiling Fixture',
      eyebrow: 'Foundations',
      intro: 'Synthetic test fixture for ceiling enforcement',
      sections: [],
      assessmentForms,
    };
  }

  it('drops items above the module Bloom ceiling (apply/analyze/evaluate excluded for a default-ceiling foundation module)', () => {
    const synModule = makeFoundationModuleWithHighItems();
    const pre = buildFormalAssessment([synModule], 'pretest');
    const taxonomies = pre.map((q) => q.taxonomy);
    expect(taxonomies).not.toContain('analyzing');
    expect(taxonomies).not.toContain('evaluating');
    expect(taxonomies).not.toContain('applying');
    // Only remember and understand survive the ceiling
    expect(taxonomies.every((t) => t === 'remembering' || t === 'understanding')).toBe(true);
    expect(pre.length).toBe(2); // only the 2 items within ceiling
  });

  it('applies the same ceiling to Form B so A/B counts stay equal', () => {
    const synModule = makeFoundationModuleWithHighItems();
    const pre = buildFormalAssessment([synModule], 'pretest');
    const post = buildFormalAssessment([synModule], 'posttest');
    expect(pre.length).toBe(post.length);
  });

  it('no delivered question for any real foundation module exceeds its declared ceiling', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const normalized = normalizeLearningModules(LEARNING_MODULES);
    const moduleById = new Map(normalized.map((m) => [m.id, m]));

    for (const item of pre) {
      const module = moduleById.get(item.moduleId);
      if (!module) continue;
      const applicable = applicableBloomTaxonomiesForModule(module);
      expect(applicable).toContain(item.taxonomy);
    }
  });

  it('no delivered question for any real foundation module exceeds its declared ceiling (post-test)', () => {
    const post = buildFormalAssessment(LEARNING_MODULES, 'posttest');
    const normalized = normalizeLearningModules(LEARNING_MODULES);
    const moduleById = new Map(normalized.map((m) => [m.id, m]));

    for (const item of post) {
      const module = moduleById.get(item.moduleId);
      if (!module) continue;
      const applicable = applicableBloomTaxonomiesForModule(module);
      expect(applicable).toContain(item.taxonomy);
    }
  });
});

// ---------------------------------------------------------------------------
// buildFormalAssessment — Bloom separation (distinct levels first)
// ---------------------------------------------------------------------------

describe('buildFormalAssessment — Bloom separation within a module', () => {
  // Build a synthetic non-foundation module with multiple items at the SAME
  // Bloom level (two remembering) and one at a different level (understanding).
  // After separation, the distinct level (understanding) should appear before
  // the second remembering item.
  function makeSeparationFixtureModule(): LearningModule {
    const itemsA: ReadonlyArray<ObjectiveAssessmentQuestion> = [
      {
        id: 'sep-module:A1', form: 'A', pairedQuestionId: 'sep-module:B1',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember',
        question: 'Remember Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0,
      },
      {
        id: 'sep-module:A2', form: 'A', pairedQuestionId: 'sep-module:B2',
        type: 'mcq', taxonomy: 'remembering', bloomLevel: 'remember',
        question: 'Remember Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1,
      },
      {
        id: 'sep-module:A3', form: 'A', pairedQuestionId: 'sep-module:B3',
        type: 'mcq', taxonomy: 'understanding', bloomLevel: 'understand',
        question: 'Understand Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 2,
      },
    ];
    const itemsB: ReadonlyArray<ObjectiveAssessmentQuestion> = itemsA.map((q) => ({
      ...q,
      id: q.id.replace(':A', ':B'),
      form: 'B' as const,
      pairedQuestionId: q.id,
      question: q.question + ' (B)',
    }));
    const assessmentForms: AssessmentForms = { A: itemsA, B: itemsB };
    return {
      id: 'sep-module',
      category: 'creational', // non-foundation, all five levels applicable
      title: 'Separation Fixture',
      eyebrow: 'Creational',
      intro: 'Synthetic test fixture',
      sections: [],
      assessmentForms,
    };
  }

  it('distinct applicable Bloom levels appear before repeated levels within a module', () => {
    const synModule = makeSeparationFixtureModule();
    const pre = buildFormalAssessment([synModule], 'pretest');

    // We have: 2× remembering, 1× understanding.
    // Separation: first slot = remembering (pos 0), second slot = understanding (pos 1),
    // third slot = second remembering (pos 2). So no two consecutive remembering items
    // appear before the understanding item has been served.
    expect(pre).toHaveLength(3);
    const taxonomies = pre.map((q) => q.taxonomy);
    // The understanding item must appear before the second remembering item.
    const understandingIdx = taxonomies.indexOf('understanding');
    const firstRememberingIdx = taxonomies.indexOf('remembering');
    const lastRememberingIdx = taxonomies.lastIndexOf('remembering');
    // There must be exactly 2 remembering items and 1 understanding item.
    expect(taxonomies.filter((t) => t === 'remembering')).toHaveLength(2);
    expect(taxonomies.filter((t) => t === 'understanding')).toHaveLength(1);
    // The understanding item must appear after the FIRST remembering but
    // before the SECOND remembering (because separation puts one per level first).
    expect(firstRememberingIdx).toBeLessThan(understandingIdx);
    expect(understandingIdx).toBeLessThan(lastRememberingIdx);
  });

  it('real module formal assessment: within each module, no Bloom level repeats while another applicable+available level is unused', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const normalized = normalizeLearningModules(LEARNING_MODULES);
    const moduleById = new Map(normalized.map((m) => [m.id, m]));

    // Group by moduleId and check within each module's question sequence
    const byModule = new Map<string, Array<{ taxonomy: BloomTaxonomy }>>();
    for (const item of pre) {
      const bucket = byModule.get(item.moduleId) ?? [];
      bucket.push({ taxonomy: item.taxonomy });
      byModule.set(item.moduleId, bucket);
    }

    for (const [moduleId, items] of byModule) {
      if (items.length <= 1) continue;
      const module = moduleById.get(moduleId);
      if (!module) continue;
      const applicable = new Set(applicableBloomTaxonomiesForModule(module));
      // Collect all taxonomies present in the delivered items for this module.
      const present = new Set(items.map((i) => i.taxonomy));

      // For each delivered item, before it appears a second time, all other
      // APPLICABLE+PRESENT levels must have appeared at least once first.
      // Verify: within items, the first occurrence of each level precedes
      // any second occurrence of another level.
      const firstOccurrence = new Map<BloomTaxonomy, number>();
      const secondOccurrence = new Map<BloomTaxonomy, number>();
      items.forEach(({ taxonomy }, idx) => {
        if (!firstOccurrence.has(taxonomy)) {
          firstOccurrence.set(taxonomy, idx);
        } else if (!secondOccurrence.has(taxonomy)) {
          secondOccurrence.set(taxonomy, idx);
        }
      });

      // For every taxonomy that has a second occurrence, check that all
      // applicable+present taxonomies had their FIRST occurrence before the second.
      for (const [, secondIdx] of secondOccurrence) {
        for (const otherTax of present) {
          if (!applicable.has(otherTax)) continue;
          const otherFirst = firstOccurrence.get(otherTax);
          if (otherFirst !== undefined) {
            expect(otherFirst).toBeLessThanOrEqual(secondIdx);
          }
        }
      }
    }
  });

  it('A/B parallelism: zero questionId overlap between pretest (A) and posttest (B) under new ordering', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const post = buildFormalAssessment(LEARNING_MODULES, 'posttest');
    const aIds = new Set(pre.map((q) => q.questionId));
    expect(post.filter((q) => aIds.has(q.questionId))).toHaveLength(0);
  });

  it('A/B parallelism: pre and post cover the same module set after ceiling + separation', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const post = buildFormalAssessment(LEARNING_MODULES, 'posttest');
    expect(new Set(pre.map((q) => q.moduleId))).toEqual(new Set(post.map((q) => q.moduleId)));
  });

  it('A/B parallelism: question counts per module are equal in pre and post', () => {
    const pre = buildFormalAssessment(LEARNING_MODULES, 'pretest');
    const post = buildFormalAssessment(LEARNING_MODULES, 'posttest');
    const countByModule = (qs: LearningAssessmentQuestion[]) => {
      const map: Record<string, number> = {};
      qs.forEach((q) => { map[q.moduleId] = (map[q.moduleId] ?? 0) + 1; });
      return map;
    };
    expect(countByModule(pre)).toEqual(countByModule(post));
  });
});

describe('optional-module detection: cycle-scoped vs freshness-gated pre-test scoring', () => {
  const MODULES = normalizeLearningModules(LEARNING_MODULES);
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  const MOD = 'creational-builder'; // real module with a complete Form A

  function perfectPretestAnswers(attemptId: number): LearningAssessmentAnswerRaw[] {
    const items = byId.get(MOD)!.assessmentForms!.A;
    return items.map((q, i) => ({
      id: attemptId * 100 + i,
      attemptId,
      assessmentType: 'pretest',
      assessmentIndex: i,
      moduleId: MOD,
      questionIndex: i,
      questionId: q.id,
      selectedIndex: q.type === 'mcq' ? q.correctIndex : 0, // all correct -> 100%
      responseText: null,
      questionTaxonomy: null,
      questionKind: 'theoretical',
      sessionId: null,
      createdAt: '2026-01-01T00:00:00Z',
    }));
  }

  // Pre-test taken 2026-01-01; the course was edited 2026-02-01 (AFTER it), so
  // the attempt is "stale" relative to courseUpdatedAt — the exact situation an
  // authenticated intern hits after the course/question bank is changed.
  const assessments: LearningAssessmentsResponse = {
    attempts: [{ id: 1, assessmentType: 'pretest', sessionId: null, questionCount: 5, cycleId: 'cyc-1', planId: 'p', createdAt: '2026-01-01T00:00:00Z' }],
    answers: perfectPretestAnswers(1),
    courseUpdatedAt: '2026-02-01T00:00:00Z',
  };

  it('freshness-gated scorer drops a pre-test older than courseUpdatedAt (root cause: optionals vanish)', () => {
    // This is what the learning path used to call — a stale attempt scores null,
    // so NO module is flagged optional and every module is forced as required.
    expect(scoreStoredObjectiveAssessment(MODULES, assessments, 'pretest')).toBeNull();
  });

  it('cycle-scoped scorer still surfaces the aced module as optional (the fix)', () => {
    // The learning path now pairs by cycleId like the Intern Dashboard, so a
    // 100% module is correctly recognized as Optional Review regardless of edits.
    const score = scoreStoredObjectiveAssessmentForCycle(MODULES, assessments, 'pretest', 'cyc-1');
    expect(score).not.toBeNull();
    expect(score!.byModule[MOD].percent).toBe(100);
  });
});
