// Question-bank validators. ERROR findings block production use (and the export
// script); WARNING needs reviewer attention; INFO is inventory/quality data.

import {
  allModuleIds,
  getAssessmentCompetencyBlueprint,
  getFormalQuestionsForModule,
  getInModuleQuestionsForModule,
  getPracticalTaskForModule,
  formalAuthoringStatus,
  isFormalEligible,
  moduleMeta,
  type ResolvedFormalQuestion,
} from './inventory';
import type { ValidationFinding, ValidationReport } from './types';

export function validateAllQuestionBanks(): ValidationReport {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const info: ValidationFinding[] = [];

  const seenIds = new Map<string, string>(); // id -> origin
  const positionCounts = [0, 0, 0, 0];
  // In-module accumulators (separate distribution + dedup vs formal).
  const inModulePositionCounts = [0, 0, 0, 0];
  const formalPromptSet = new Set<string>(); // normalized formal prompts (dup guard)
  const inModulePromptSeen = new Map<string, string>(); // normalized prompt -> questionId
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const registerId = (id: string, origin: string, moduleId: string) => {
    if (seenIds.has(id)) {
      errors.push({ severity: 'ERROR', code: 'DUPLICATE_ID', message: `Duplicate question id ${id} (${seenIds.get(id)} & ${origin})`, questionId: id, moduleId });
    } else {
      seenIds.set(id, origin);
    }
  };

  const checkFormalItem = (q: ResolvedFormalQuestion) => {
    const { questionId: id, moduleId } = q;
    if (q.raw.type !== 'mcq') {
      errors.push({ severity: 'ERROR', code: 'FORMAL_NOT_MCQ', message: `Formal item ${id} is not an MCQ`, questionId: id, moduleId });
      return;
    }
    if (q.options.length !== 4) {
      errors.push({ severity: 'ERROR', code: 'OPTION_COUNT', message: `${id} has ${q.options.length} options (need 4)`, questionId: id, moduleId });
    }
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) {
      errors.push({ severity: 'ERROR', code: 'DUPLICATE_OPTION', message: `${id} has duplicate options`, questionId: id, moduleId });
    }
    if (q.options.some((o) => !o.trim())) {
      errors.push({ severity: 'ERROR', code: 'EMPTY_OPTION', message: `${id} has an empty option`, questionId: id, moduleId });
    }
    if (!q.prompt.trim()) {
      errors.push({ severity: 'ERROR', code: 'EMPTY_PROMPT', message: `${id} has an empty prompt`, questionId: id, moduleId });
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      errors.push({ severity: 'ERROR', code: 'BAD_CORRECT_INDEX', message: `${id} correctIndex ${q.correctIndex} out of range`, questionId: id, moduleId });
    } else {
      positionCounts[q.correctIndex] += 1;
    }
    if ((q.bloomLevel as string) === 'create') {
      errors.push({ severity: 'ERROR', code: 'CREATE_AS_MCQ', message: `${id} is an MCQ tagged Create (Create must be a practical task)`, questionId: id, moduleId });
    }
    if (!q.form) {
      errors.push({ severity: 'ERROR', code: 'MISSING_FORM', message: `${id} has no derivable Form A/B`, questionId: id, moduleId });
    }
    if (!q.pairedQuestionId) {
      errors.push({ severity: 'ERROR', code: 'MISSING_PAIR', message: `${id} has no paired question id`, questionId: id, moduleId });
    }
    if (!q.competencyId) {
      warnings.push({ severity: 'WARNING', code: 'MISSING_COMPETENCY', message: `${id} has no competencyId`, questionId: id, moduleId });
    }
    if (!q.rationale.trim()) {
      warnings.push({ severity: 'WARNING', code: 'MISSING_RATIONALE', message: `${id} has no rationale`, questionId: id, moduleId });
    }
    if (q.sourceReferences.length === 0) {
      warnings.push({ severity: 'WARNING', code: 'MISSING_SOURCE', message: `${id} has no source reference`, questionId: id, moduleId });
    }
  };

  for (const moduleId of allModuleIds()) {
    const meta = moduleMeta(moduleId);
    const blueprint = getAssessmentCompetencyBlueprint(moduleId);
    const status = formalAuthoringStatus(moduleId);

    const formA = getFormalQuestionsForModule(moduleId, 'A');
    const formB = getFormalQuestionsForModule(moduleId, 'B');
    formA.forEach((q) => { registerId(q.questionId, 'formal:A', moduleId); checkFormalItem(q); if (q.prompt.trim()) formalPromptSet.add(norm(q.prompt)); });
    formB.forEach((q) => { registerId(q.questionId, 'formal:B', moduleId); checkFormalItem(q); if (q.prompt.trim()) formalPromptSet.add(norm(q.prompt)); });

    if (status === 'pending') {
      if (isFormalEligible(moduleId)) {
        warnings.push({ severity: 'WARNING', code: 'FORMAL_PENDING', message: `${moduleId} (${meta?.title}) has no authored Form A/B yet — pending authoring`, moduleId });
      } else {
        info.push({ severity: 'INFO', code: 'FORMAL_INELIGIBLE', message: `${moduleId} (${meta?.title}) is learning-only (open-ended) — no formal forms expected`, moduleId });
      }
    } else {
      if (formA.length !== formB.length) {
        errors.push({ severity: 'ERROR', code: 'AB_COUNT_MISMATCH', message: `${moduleId}: Form A has ${formA.length} items, Form B has ${formB.length}`, moduleId });
      }
      // A/B id overlap
      const aIds = new Set(formA.map((q) => q.questionId));
      formB.forEach((q) => {
        if (aIds.has(q.questionId)) errors.push({ severity: 'ERROR', code: 'AB_ID_OVERLAP', message: `${q.questionId} appears in both forms`, questionId: q.questionId, moduleId });
      });
      // pairing checks
      const byId = new Map([...formA, ...formB].map((q) => [q.questionId, q]));
      const aPrompts = new Set(formA.map((q) => q.prompt.trim().toLowerCase()));
      for (const q of formA) {
        const mate = q.pairedQuestionId ? byId.get(q.pairedQuestionId) : undefined;
        if (!mate) {
          errors.push({ severity: 'ERROR', code: 'PAIR_NOT_FOUND', message: `${q.questionId} paired ${q.pairedQuestionId} not found`, questionId: q.questionId, moduleId });
          continue;
        }
        if (mate.bloomLevel !== q.bloomLevel) errors.push({ severity: 'ERROR', code: 'PAIR_BLOOM_MISMATCH', message: `${q.questionId}/${mate.questionId} differ in Bloom level`, questionId: q.questionId, moduleId });
        if (mate.competencyId !== q.competencyId) {
          // Hard error only when BOTH items declare an explicit competencyId
          // (authored items). Pilot items predate competencyId — their derived
          // labels differing is a reviewer WARNING, not a blocker.
          const bothExplicit = !!q.raw.competencyId && !!mate.raw.competencyId;
          (bothExplicit ? errors : warnings).push({
            severity: bothExplicit ? 'ERROR' : 'WARNING',
            code: 'PAIR_COMPETENCY_MISMATCH',
            message: `${q.questionId}/${mate.questionId} differ in competency`,
            questionId: q.questionId,
            moduleId,
          });
        }
        if (mate.prompt.trim().toLowerCase() === q.prompt.trim().toLowerCase()) errors.push({ severity: 'ERROR', code: 'PAIR_IDENTICAL_PROMPT', message: `${q.questionId}/${mate.questionId} have identical prompts`, questionId: q.questionId, moduleId });
      }
      void aPrompts;
    }

    // ---- In-module conceptual bank validation ----
    const inModule = getInModuleQuestionsForModule(moduleId);
    const seenSrcIdx = new Set<number>();
    const repoIsGof = moduleId === 'structural-repository';
    inModule.forEach((q) => {
      registerId(q.questionId, 'in-module', moduleId); // collision check across banks
      // sourceQuestionIndex must be unique within a module (analytics key).
      if (seenSrcIdx.has(q.sourceQuestionIndex)) {
        errors.push({ severity: 'ERROR', code: 'IM_DUPLICATE_SOURCE_INDEX', message: `${moduleId}: duplicate sourceQuestionIndex ${q.sourceQuestionIndex}`, questionId: q.questionId, moduleId });
      } else seenSrcIdx.add(q.sourceQuestionIndex);
      // Only APPLICABLE (authored, non-fallback) items face content checks.
      if (!q.applicable) return;
      // Create must never be an applicable MCQ.
      if ((q.bloomLevel as string) === 'create' || (q.bloomLevel as string) === 'creating') {
        errors.push({ severity: 'ERROR', code: 'IM_CREATE_AS_MCQ', message: `${q.questionId} is an applicable Create-level MCQ (Create must be the practical task)`, questionId: q.questionId, moduleId });
      }
      if (q.type !== 'mcq') {
        // An applicable in-module item should be an MCQ.
        warnings.push({ severity: 'WARNING', code: 'IM_NOT_MCQ', message: `${q.questionId} is applicable but not an MCQ`, questionId: q.questionId, moduleId });
        return;
      }
      if (q.options.length !== 4) errors.push({ severity: 'ERROR', code: 'IM_OPTION_COUNT', message: `${q.questionId} has ${q.options.length} options (need 4)`, questionId: q.questionId, moduleId });
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) errors.push({ severity: 'ERROR', code: 'IM_DUPLICATE_OPTION', message: `${q.questionId} has duplicate options`, questionId: q.questionId, moduleId });
      if (q.options.some((o) => !o.trim())) errors.push({ severity: 'ERROR', code: 'IM_EMPTY_OPTION', message: `${q.questionId} has an empty option`, questionId: q.questionId, moduleId });
      if (!q.prompt.trim()) errors.push({ severity: 'ERROR', code: 'IM_EMPTY_PROMPT', message: `${q.questionId} has an empty prompt`, questionId: q.questionId, moduleId });
      if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
        errors.push({ severity: 'ERROR', code: 'IM_BAD_CORRECT_INDEX', message: `${q.questionId} correctIndex ${q.correctIndex} out of range`, questionId: q.questionId, moduleId });
      } else {
        inModulePositionCounts[q.correctIndex] += 1;
      }
      if (!q.competencyId) warnings.push({ severity: 'WARNING', code: 'IM_MISSING_COMPETENCY', message: `${q.questionId} has no competencyId`, questionId: q.questionId, moduleId });
      if (!q.rationale || !q.rationale.trim()) warnings.push({ severity: 'WARNING', code: 'IM_MISSING_RATIONALE', message: `${q.questionId} has no rationale`, questionId: q.questionId, moduleId });
      if (!q.sourceReferences || q.sourceReferences.length === 0) warnings.push({ severity: 'WARNING', code: 'IM_MISSING_SOURCE', message: `${q.questionId} has no source reference`, questionId: q.questionId, moduleId });
      // Non-GoF classification guards.
      if (repoIsGof && (q.sourceReferences ?? []).some((s) => /gamma|gang of four|gof/i.test(s))) {
        errors.push({ severity: 'ERROR', code: 'IM_REPOSITORY_GOF', message: `${q.questionId} cites a GoF source for Repository (Repository is NOT a GoF pattern)`, questionId: q.questionId, moduleId });
      }
      // Duplicate vs formal Form A/B prompt (exact = ERROR: must use different wording).
      const np = norm(q.prompt);
      if (formalPromptSet.has(np)) {
        errors.push({ severity: 'ERROR', code: 'IM_DUP_OF_FORMAL', message: `${q.questionId} prompt is identical to a formal Form A/B item`, questionId: q.questionId, moduleId });
      }
      // Duplicate prompt across the in-module bank.
      if (inModulePromptSeen.has(np)) {
        errors.push({ severity: 'ERROR', code: 'IM_DUPLICATE_PROMPT', message: `${q.questionId} duplicates in-module prompt of ${inModulePromptSeen.get(np)}`, questionId: q.questionId, moduleId });
      } else inModulePromptSeen.set(np, q.questionId);
    });

    // Practical create coverage for full design-pattern modules.
    const practical = getPracticalTaskForModule(moduleId);
    if (practical) registerId(practical.taskId, 'practical', moduleId);
    if (blueprint?.requiresPracticalCreate && !practical) {
      warnings.push({ severity: 'WARNING', code: 'MISSING_PRACTICAL', message: `${moduleId} should have a Create practical task but none found`, moduleId });
    }
  }

  // Answer-position distribution (INFO) + imbalance (WARNING).
  const total = positionCounts.reduce((a, b) => a + b, 0);
  info.push({ severity: 'INFO', code: 'ANSWER_POSITIONS', message: `Formal correctIndex distribution A/B/C/D = ${positionCounts.join('/')} (of ${total})` });
  if (total >= 8) {
    const maxShare = Math.max(...positionCounts) / total;
    if (maxShare > 0.6) warnings.push({ severity: 'WARNING', code: 'ANSWER_IMBALANCE', message: `One answer position holds ${(maxShare * 100).toFixed(0)}% of correct answers` });
  }

  // In-module answer-position distribution (INFO) + imbalance (WARNING).
  const imTotal = inModulePositionCounts.reduce((a, b) => a + b, 0);
  info.push({ severity: 'INFO', code: 'IM_ANSWER_POSITIONS', message: `In-module correctIndex distribution A/B/C/D = ${inModulePositionCounts.join('/')} (of ${imTotal})` });
  if (imTotal >= 8) {
    const maxShare = Math.max(...inModulePositionCounts) / imTotal;
    if (maxShare > 0.6) warnings.push({ severity: 'WARNING', code: 'IM_ANSWER_IMBALANCE', message: `One in-module answer position holds ${(maxShare * 100).toFixed(0)}% of correct answers` });
  }

  return { errors, warnings, info, ok: errors.length === 0 };
}
