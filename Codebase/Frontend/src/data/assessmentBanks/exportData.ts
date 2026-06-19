// Aggregates the authoritative banks into one plain JSON-able structure for the
// review export. All formatting (TXT/CSV) lives in the export script; this file
// owns the data + ordering so the two never drift.

import {
  allModuleIds,
  moduleMeta,
  getAssessmentCompetencyBlueprint,
  getFormalQuestionsForModule,
  getInModuleQuestionsForModule,
  getPracticalTaskForModule,
  formalAuthoringStatus,
  isFormalEligible,
} from './inventory';
import { validateAllQuestionBanks } from './validators';
import type { ValidationReport, ModuleAssessmentBlueprint } from './types';

const CATEGORY_ORDER = ['foundations', 'creational', 'structural', 'behavioural', 'idioms'];

export interface ReviewModule {
  moduleId: string;
  moduleTitle: string;
  category: string;
  status: 'authored' | 'pending';
  blueprint: ModuleAssessmentBlueprint | null;
  formA: ReturnType<typeof getFormalQuestionsForModule>;
  formB: ReturnType<typeof getFormalQuestionsForModule>;
  inModule: ReturnType<typeof getInModuleQuestionsForModule>;
  practical: ReturnType<typeof getPracticalTaskForModule>;
}

export interface ReviewData {
  modules: ReviewModule[];
  counts: {
    totalModules: number;
    formalEligibleModules: number;
    authoredModules: number;
    formA: number;
    formB: number;
    inModule: number;
    practical: number;
    grandTotal: number;
    byCategory: Record<string, number>;
  };
  validation: ValidationReport;
}

export function collectReviewData(): ReviewData {
  const ids = allModuleIds();
  const modules: ReviewModule[] = ids
    .map((moduleId) => {
      const meta = moduleMeta(moduleId);
      return {
        moduleId,
        moduleTitle: meta?.title ?? moduleId,
        category: meta?.category ?? 'unknown',
        status: formalAuthoringStatus(moduleId),
        blueprint: getAssessmentCompetencyBlueprint(moduleId),
        formA: getFormalQuestionsForModule(moduleId, 'A'),
        formB: getFormalQuestionsForModule(moduleId, 'B'),
        inModule: getInModuleQuestionsForModule(moduleId),
        practical: getPracticalTaskForModule(moduleId),
      };
    })
    .sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(a.category);
      const cb = CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.moduleId.localeCompare(b.moduleId);
    });

  const counts = {
    totalModules: modules.length,
    formalEligibleModules: modules.filter((m) => isFormalEligible(m.moduleId)).length,
    authoredModules: modules.filter((m) => m.status === 'authored').length,
    formA: modules.reduce((n, m) => n + m.formA.length, 0),
    formB: modules.reduce((n, m) => n + m.formB.length, 0),
    inModule: modules.reduce((n, m) => n + m.inModule.length, 0),
    practical: modules.filter((m) => m.practical).length,
    grandTotal: 0,
    byCategory: {} as Record<string, number>,
  };
  counts.grandTotal = counts.formA + counts.formB + counts.inModule + counts.practical;
  for (const m of modules) counts.byCategory[m.category] = (counts.byCategory[m.category] ?? 0) + 1;

  return { modules, counts, validation: validateAllQuestionBanks() };
}
