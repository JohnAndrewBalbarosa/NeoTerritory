// Canonical assessment-bank types. These re-use the shared model types from
// learningModules.ts (no competing duplicates) and add the blueprint +
// validation shapes used by the bank engine and the review export.

import type {
  ObjectiveAssessmentQuestion,
  ObjectiveBloomLevel,
  AssessmentDifficulty,
  AssessmentValidationStatus,
  PracticalAssessmentTask,
} from '../learningModules';

export type {
  ObjectiveAssessmentQuestion,
  ObjectiveBloomLevel,
  AssessmentDifficulty,
  AssessmentValidationStatus,
  PracticalAssessmentTask,
};

export const ALL_BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
] as const;
export type AnyBloomLevel = (typeof ALL_BLOOM_LEVELS)[number];

// A formal item is an ObjectiveAssessmentQuestion that MUST carry the formal
// metadata (form + pairing). The base fields stay optional on the model so
// legacy/in-module entries still type; the bank engine validates presence.
export type FormalAssessmentQuestion = ObjectiveAssessmentQuestion & {
  form: 'A' | 'B';
  pairedQuestionId: string;
};

// Per-module competency + applicable-Bloom blueprint. Foundation modules
// legitimately leave higher levels non-applicable; design-pattern modules cover
// remember..evaluate (objective) + create (practical).
export interface ModuleAssessmentBlueprint {
  moduleId: string;
  category: string;
  // False for intentionally learning-only modules (e.g. open-ended reflection)
  // that have no single defensible correct answer — excluded from formal forms.
  formalEligible: boolean;
  // Bloom levels the module's objective items SHOULD cover.
  applicableObjectiveLevels: ReadonlyArray<ObjectiveBloomLevel>;
  // Levels deliberately not assessed for this module (documented, not forced).
  nonApplicableLevels: ReadonlyArray<AnyBloomLevel>;
  // True when a Create-level practical coding task is required for this module.
  requiresPracticalCreate: boolean;
  competencyIds: ReadonlyArray<string>;
  notes?: string;
}

export interface AssessmentCompetency {
  competencyId: string;
  moduleId: string;
  title: string;
  description: string;
}

// Validation finding severities, per the spec.
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';
export interface ValidationFinding {
  severity: ValidationSeverity;
  code: string;
  message: string;
  questionId?: string;
  moduleId?: string;
}
export interface ValidationReport {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  info: ValidationFinding[];
  ok: boolean; // true when there are zero ERROR findings
}
