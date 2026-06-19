// Public, stable accessors over the authoritative question banks + computed
// blueprints. Metadata that older/pilot entries omit is DERIVED here (bloom from
// taxonomy, form/pairing from the id) so no legacy entry needs editing.

import {
  LEARNING_MODULES,
  normalizeLearningModules,
  isStudioQuestion,
  type BloomTaxonomy,
  type LearningModule,
  type ObjectiveAssessmentQuestion,
  type ObjectiveBloomLevel,
  type AssessmentDifficulty,
  type AssessmentValidationStatus,
  type PracticalAssessmentTask,
} from '../learningModules';
import { ASSESSMENT_FORMS } from '../assessmentForms';
import { ALL_BLOOM_LEVELS, type AnyBloomLevel, type ModuleAssessmentBlueprint } from './types';

const MODULES: ReadonlyArray<LearningModule> = normalizeLearningModules(LEARNING_MODULES);
const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

// Vocabulary bridge: BloomTaxonomy (question-level, 'remembering'…) ↔ ObjectiveBloomLevel ('remember'…).
// Canonical low→high ordering used for Bloom-separation ordering in delivery.
export const TAXONOMY_TO_BLOOM: Record<string, ObjectiveBloomLevel> = {
  remembering: 'remember',
  understanding: 'understand',
  applying: 'apply',
  analyzing: 'analyze',
  evaluating: 'evaluate',
};

// Reverse mapping: ObjectiveBloomLevel → BloomTaxonomy.
// 'create' is intentionally absent — it is practical-only, never objective.
export const BLOOM_TO_TAXONOMY: Record<ObjectiveBloomLevel, BloomTaxonomy> = {
  remember: 'remembering',
  understand: 'understanding',
  apply: 'applying',
  analyze: 'analyzing',
  evaluate: 'evaluating',
};

export function deriveBloomLevel(q: ObjectiveAssessmentQuestion): ObjectiveBloomLevel {
  return q.bloomLevel ?? TAXONOMY_TO_BLOOM[(q.taxonomy as BloomTaxonomy) ?? 'remembering'] ?? 'remember';
}
function deriveDifficulty(q: ObjectiveAssessmentQuestion): AssessmentDifficulty {
  if (q.difficulty) return q.difficulty;
  const b = deriveBloomLevel(q);
  if (b === 'remember') return 'easy';
  if (b === 'understand' || b === 'apply') return 'moderate';
  return 'difficult';
}
function deriveForm(q: ObjectiveAssessmentQuestion): 'A' | 'B' | null {
  if (q.form) return q.form;
  const m = /:([AB])\d+$/.exec(q.id);
  return m ? (m[1] as 'A' | 'B') : null;
}
function derivePairedId(q: ObjectiveAssessmentQuestion): string | null {
  if (q.pairedQuestionId) return q.pairedQuestionId;
  const m = /^(.*):([AB])(\d+)$/.exec(q.id);
  if (!m) return null;
  return `${m[1]}:${m[2] === 'A' ? 'B' : 'A'}${m[3]}`;
}

// A fully-resolved formal item view used by validators + export.
export interface ResolvedFormalQuestion {
  questionId: string;
  moduleId: string;
  form: 'A' | 'B' | null;
  pairedQuestionId: string | null;
  competencyId: string;
  bloomLevel: ObjectiveBloomLevel;
  difficulty: AssessmentDifficulty;
  prompt: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  rationale: string;
  sourceReferences: ReadonlyArray<string>;
  validationStatus: AssessmentValidationStatus;
  raw: ObjectiveAssessmentQuestion;
}

function isPilotModule(moduleId: string): boolean {
  return moduleId === 'foundations-what-is-pattern' || moduleId === 'creational-builder';
}

export function resolveFormalQuestion(q: ObjectiveAssessmentQuestion, moduleId: string): ResolvedFormalQuestion {
  return {
    questionId: q.id,
    moduleId,
    form: deriveForm(q),
    pairedQuestionId: derivePairedId(q),
    competencyId: q.competencyId ?? q.competency ?? `${moduleId}-general`,
    bloomLevel: deriveBloomLevel(q),
    difficulty: deriveDifficulty(q),
    prompt: q.type === 'mcq' || q.type === 'identification' ? q.question : '',
    options: q.type === 'mcq' ? q.options : [],
    correctIndex: q.type === 'mcq' ? q.correctIndex : -1,
    rationale: q.rationale ?? '',
    sourceReferences: q.sourceReferences ?? [],
    validationStatus: q.validationStatus ?? (isPilotModule(moduleId) ? 'pilot-reviewed' : 'draft'),
    raw: q,
  };
}

export function getFormalQuestionsForModule(moduleId: string, form: 'A' | 'B'): ResolvedFormalQuestion[] {
  const items = ASSESSMENT_FORMS[moduleId]?.[form] ?? [];
  return items.map((q) => resolveFormalQuestion(q, moduleId));
}

export interface ResolvedInModuleQuestion {
  questionId: string;
  moduleId: string;
  sourceQuestionIndex: number;
  bloomLevel: AnyBloomLevel;
  type: 'mcq' | 'identification' | 'studio';
  prompt: string;
  options: ReadonlyArray<string>;
  correctIndex: number;
  generatedFallback: boolean;
  // applicable = a real authored learner question at this Bloom index. Generated
  // fallbacks (non-applicable Bloom levels + Create) are NOT applicable: hidden
  // from learners, index preserved. The flag is `!generatedFallback`.
  applicable: boolean;
  // Authored review metadata (undefined for generated fallbacks).
  competencyId?: string;
  difficulty?: AssessmentDifficulty;
  rationale?: string;
  sourceReferences?: ReadonlyArray<string>;
  validationStatus?: AssessmentValidationStatus;
}

// In-module conceptual bank = the module's theoreticalExam, by ORIGINAL index
// (analytics key). Order/indexes are NOT changed here.
export function getInModuleQuestionsForModule(moduleId: string): ResolvedInModuleQuestion[] {
  const m = MODULE_BY_ID.get(moduleId);
  const qs = m?.theoreticalExam?.questions ?? [];
  return qs.map((q, i) => ({
    questionId: q.id ?? `${moduleId}:IM-${i}`,
    moduleId,
    sourceQuestionIndex: i,
    bloomLevel: ((q.taxonomy as AnyBloomLevel) ?? 'remember'),
    type: q.type,
    prompt: q.type === 'studio' ? q.prompt : q.question,
    options: q.type === 'mcq' ? q.options : [],
    correctIndex: q.type === 'mcq' ? q.correctIndex : -1,
    generatedFallback: !!q.generatedFallback,
    applicable: !q.generatedFallback,
    competencyId: q.competencyId,
    difficulty: q.difficulty,
    rationale: q.rationale,
    sourceReferences: q.sourceReferences,
    validationStatus: q.validationStatus,
  }));
}

// Practical Create-level task, derived from the module's practicalExam.
export function getPracticalTaskForModule(moduleId: string): PracticalAssessmentTask | null {
  const m = MODULE_BY_ID.get(moduleId);
  const p = m?.practicalExam;
  if (!p) return null;
  return {
    taskId: `${moduleId}:CREATE`,
    moduleId,
    competencyId: `${moduleId}-implement`,
    bloomLevel: 'create',
    difficulty: 'difficult',
    taskPrompt: p.prompt,
    expectedPatternEvidence: [`Analyzer tags the ${p.patternName} pattern`, `Structural evidence consistent with ${p.patternName}`],
    validationCriteria: [
      `Studio analyzer detects ${p.patternName}`,
      ...(p.passMode === 'detection_and_tests' ? ['All Studio unit tests pass'] : []),
    ],
    sourceReferences: ['CodiNeo Microservice pattern catalog', `Gamma et al. (1994) — ${p.patternName}`],
    validationStatus: 'pilot-reviewed',
  };
}

// Intentionally learning-only modules: open-ended/reflective content with no
// single defensible correct answer — never formally assessed (no Form A/B).
const FORMAL_INELIGIBLE_MODULES = new Set<string>(['foundations-postrequisite']);
export function isFormalEligible(moduleId: string): boolean {
  return !FORMAL_INELIGIBLE_MODULES.has(moduleId);
}

// Per-module overrides for foundation modules whose content does not reach all
// five objective levels. Non-foundation modules default to the full five levels.
// Foundation modules without an override default to ['remember', 'understand'].
const FOUNDATION_LEVEL_OVERRIDES: Record<string, ReadonlyArray<ObjectiveBloomLevel>> = {
  'foundations-what-is-pattern': ['remember', 'understand', 'apply'],
  'foundations-ambiguity': ['remember', 'understand', 'apply', 'analyze', 'evaluate'],
  'foundations-same-structure': ['remember', 'understand', 'analyze'],
  'foundations-structural-rules': ['remember', 'understand', 'analyze'],
  'foundations-interface-principle': ['remember', 'understand', 'apply'],
  'foundations-categories': ['remember', 'understand'],
};

// Canonical low→high ordering for the five objective Bloom levels.
const OBJECTIVE_BLOOM_ORDER: ReadonlyArray<ObjectiveBloomLevel> = [
  'remember', 'understand', 'apply', 'analyze', 'evaluate',
];

/**
 * Returns the applicable ObjectiveBloomLevel list for a module, ordered low→high.
 * Foundation modules are capped at their authored ceiling (see FOUNDATION_LEVEL_OVERRIDES).
 * Non-foundation modules span all five objective levels.
 * 'create' (practical) is never included here.
 */
export function applicableObjectiveLevelsForModule(
  module: Pick<LearningModule, 'id' | 'category'>,
): ReadonlyArray<ObjectiveBloomLevel> {
  if (module.category !== 'foundations') {
    return OBJECTIVE_BLOOM_ORDER;
  }
  return FOUNDATION_LEVEL_OVERRIDES[module.id] ?? ['remember', 'understand'];
}

/**
 * Returns the applicable BloomTaxonomy list for a module, ordered low→high.
 * Derived from applicableObjectiveLevelsForModule via the vocab mapping.
 * 'creating' is never included here — it belongs to the separate practical.
 */
export function applicableBloomTaxonomiesForModule(
  module: Pick<LearningModule, 'id' | 'category'>,
): ReadonlyArray<BloomTaxonomy> {
  return applicableObjectiveLevelsForModule(module).map((level) => BLOOM_TO_TAXONOMY[level]);
}

export function getAssessmentCompetencyBlueprint(moduleId: string): ModuleAssessmentBlueprint | null {
  const m = MODULE_BY_ID.get(moduleId);
  if (!m) return null;
  // Delegate to the exported helper so there is one source of truth.
  const applicableObjectiveLevels = applicableObjectiveLevelsForModule(m);
  const requiresPracticalCreate = m.category !== 'foundations' && !!m.practicalExam;
  const applicableAny = new Set<AnyBloomLevel>([...applicableObjectiveLevels, ...(requiresPracticalCreate ? ['create' as const] : [])]);
  return {
    moduleId,
    category: m.category,
    formalEligible: isFormalEligible(moduleId),
    applicableObjectiveLevels,
    nonApplicableLevels: ALL_BLOOM_LEVELS.filter((l) => !applicableAny.has(l)),
    requiresPracticalCreate,
    competencyIds: [],
  };
}

// A module is formally assessable once authored Form A AND Form B exist.
export function formalAuthoringStatus(moduleId: string): 'authored' | 'pending' {
  const f = ASSESSMENT_FORMS[moduleId];
  return f && f.A.length > 0 && f.B.length > 0 ? 'authored' : 'pending';
}

export interface FormalInventoryRow {
  moduleId: string;
  moduleTitle: string;
  category: string;
  formA: number;
  formB: number;
  inModule: number;
  hasPractical: boolean;
  status: 'authored' | 'pending';
}

export function getFormalAssessmentInventory(): FormalInventoryRow[] {
  return MODULES.map((m) => ({
    moduleId: m.id,
    moduleTitle: m.title,
    category: m.category,
    formA: ASSESSMENT_FORMS[m.id]?.A.length ?? 0,
    formB: ASSESSMENT_FORMS[m.id]?.B.length ?? 0,
    inModule: m.theoreticalExam?.questions.length ?? 0,
    hasPractical: !!m.practicalExam,
    status: formalAuthoringStatus(m.id),
  }));
}

export function allModuleIds(): string[] {
  return MODULES.map((m) => m.id);
}
export function moduleMeta(moduleId: string): { title: string; category: string } | null {
  const m = MODULE_BY_ID.get(moduleId);
  return m ? { title: m.title, category: m.category } : null;
}
// Re-export so the practical-evidence export can flag studio items if needed.
export { isStudioQuestion };
