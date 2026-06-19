// Shared builder for authored in-module conceptual questions. These are MCQ
// ExamQuestions carrying full review metadata; the normalizer slots each one at
// its fixed Bloom index (0=remember … 4=evaluate) and assigns the stable id
// `${moduleId}:${taxonomy}`. Create (index 5) is NEVER authored here — it is the
// practical C++ task. Non-applicable Bloom levels are simply omitted; the
// normalizer pads them as hidden generated fallbacks at a preserved index.

import type { ExamQuestion, BloomTaxonomy, AssessmentDifficulty } from '../../learningModules';

// Authoring helper. `taxonomy` is the pipeline tag the normalizer keys on; the
// metadata Bloom level is derived from it at read time (getInModuleQuestionsForModule),
// so it is not stored on the item. Author only remembering→evaluating (Create is
// the practical task).
export const imq = (
  taxonomy: Exclude<BloomTaxonomy, 'creating'>,
  competencyId: string,
  difficulty: AssessmentDifficulty,
  question: string,
  options: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  rationale: string,
  sourceReferences: ReadonlyArray<string>,
): ExamQuestion => ({
  type: 'mcq', taxonomy, competencyId, difficulty,
  question, options, correctIndex, rationale, sourceReferences, validationStatus: 'draft',
  explanation: rationale,
});

export type InModuleBank = Record<string, ReadonlyArray<ExamQuestion>>;
