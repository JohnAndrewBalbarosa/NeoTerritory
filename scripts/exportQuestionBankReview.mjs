#!/usr/bin/env node
// Generate the human-readable question-bank review files in
// docs/question-bank-review/ from the AUTHORITATIVE banks (no hand-maintained
// answer key). Deterministic ordering: category → module → assessment type →
// Bloom. Fails (exit 1) if blocking validation ERRORs exist.
//
// Usage (from repo root or anywhere): npm run assessment:export-review
//   (script: node scripts/exportQuestionBankReview.mjs)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ENTRY = resolve(REPO_ROOT, 'Codebase/Frontend/src/data/assessmentBanks/index.ts');
const OUT_DIR = resolve(REPO_ROOT, 'docs/question-bank-review');
const requireFromFrontend = createRequire(pathToFileURL(resolve(REPO_ROOT, 'Codebase/Frontend/package.json')));

const LETTERS = ['A', 'B', 'C', 'D'];
const titleCaseBloom = (b) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : '');
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

async function loadBank() {
  const esbuild = requireFromFrontend('esbuild');
  const result = await esbuild.build({ entryPoints: [ENTRY], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  const tmp = resolve(os.tmpdir(), `nt-qbank-${process.pid}.mjs`);
  await writeFile(tmp, result.outputFiles[0].text, 'utf8');
  try {
    return (await import(pathToFileURL(tmp).href)).collectReviewData();
  } finally {
    await rm(tmp, { force: true });
  }
}

function formatFormal(q, n, typeLabel) {
  const letter = LETTERS[q.correctIndex] ?? '?';
  return [
    `Question ${n}`,
    `Question ID: ${q.questionId}`,
    `Paired Question ID: ${q.pairedQuestionId ?? '(none)'}`,
    `Competency ID: ${q.competencyId}`,
    `Bloom Level: ${titleCaseBloom(q.bloomLevel)}`,
    `Difficulty: ${titleCase(q.difficulty)}`,
    `Validation Status: ${q.validationStatus}`,
    '',
    'QUESTION:',
    q.prompt,
    '',
    'OPTIONS:',
    ...q.options.map((o, i) => `${LETTERS[i]}. ${o}`),
    '',
    'CORRECT ANSWER:',
    `${letter}. ${q.options[q.correctIndex] ?? ''}`,
    '',
    'RATIONALE:',
    q.rationale || '(rationale pending — WARNING)',
    '',
    'SOURCE REFERENCES:',
    ...(q.sourceReferences.length ? q.sourceReferences.map((s) => `* ${s}`) : ['* (source pending — WARNING)']),
    '',
    '------------------------------------------------',
    '',
  ].join('\n');
  void typeLabel;
}

function formatInModule(q, n) {
  return [
    `Question ${n}`,
    `Question ID: ${q.questionId}`,
    `Assessment Type: In-Module Conceptual Assessment`,
    `Source Question Index: ${q.sourceQuestionIndex}`,
    `Bloom Level: ${titleCaseBloom(q.bloomLevel)}`,
    `Item Type: ${q.type}${q.generatedFallback ? ' (GENERATED FALLBACK — excluded from formal assessment)' : ''}`,
    '',
    'QUESTION:',
    q.prompt,
    ...(q.options.length ? ['', 'OPTIONS:', ...q.options.map((o, i) => `${LETTERS[i]}. ${o}`)] : []),
    ...(q.correctIndex >= 0 ? ['', `CORRECT ANSWER: ${LETTERS[q.correctIndex]}. ${q.options[q.correctIndex] ?? ''}`] : []),
    '',
    '------------------------------------------------',
    '',
  ].join('\n');
}

function formatPractical(t) {
  return [
    `Task ID: ${t.taskId}`,
    `Assessment Type: Practical C++ Assessment`,
    `Bloom Level: Create`,
    `Difficulty: ${titleCase(t.difficulty)}`,
    `Validation Status: ${t.validationStatus}`,
    '',
    'TASK:',
    t.taskPrompt,
    '',
    'EXPECTED PATTERN EVIDENCE:',
    ...t.expectedPatternEvidence.map((e) => `* ${e}`),
    '',
    'VALIDATION CRITERIA:',
    ...t.validationCriteria.map((c) => `* ${c}`),
    '',
    'SOURCE REFERENCES:',
    ...t.sourceReferences.map((s) => `* ${s}`),
    '',
    '------------------------------------------------',
    '',
  ].join('\n');
}

function header(counts, validation, now) {
  return [
    'CODINEO QUESTION BANK REVIEW',
    `Generated: ${now}`,
    `Total Learning Modules: ${counts.totalModules}`,
    `Total Formal-Eligible Modules: ${counts.formalEligibleModules}`,
    `Modules with Authored Form A+B: ${counts.authoredModules}`,
    `Total Form A Questions: ${counts.formA}`,
    `Total Form B Questions: ${counts.formB}`,
    `Total In-Module Conceptual Questions: ${counts.inModule}`,
    `Total Practical Tasks: ${counts.practical}`,
    `Total Questions and Tasks: ${counts.grandTotal}`,
    `Validation Errors: ${validation.errors.length}`,
    `Validation Warnings: ${validation.warnings.length}`,
    '',
    '================================================================',
    '',
  ].join('\n');
}

function moduleHeader(m, typeLabel) {
  return [
    '================================================================',
    `CATEGORY: ${m.category.toUpperCase()}`,
    `MODULE: ${m.moduleTitle}`,
    `MODULE ID: ${m.moduleId}`,
    `ASSESSMENT TYPE: ${typeLabel}`,
    m.blueprint ? `APPLICABLE BLOOM LEVELS: ${m.blueprint.applicableObjectiveLevels.map(titleCaseBloom).join(', ') || '(none)'}` : '',
    m.blueprint ? `NON-APPLICABLE LEVELS: ${m.blueprint.nonApplicableLevels.map(titleCaseBloom).join(', ') || '(none)'}` : '',
    '================================================================',
    '',
  ].filter(Boolean).join('\n');
}

async function main() {
  const data = await loadBank();
  const now = new Date().toISOString();
  await mkdir(OUT_DIR, { recursive: true });

  const master = [header(data.counts, data.validation, now)];
  const formA = [header(data.counts, data.validation, now)];
  const formB = [header(data.counts, data.validation, now)];
  const inMod = [header(data.counts, data.validation, now)];
  const practical = [header(data.counts, data.validation, now)];
  const csv = ['category,moduleId,moduleTitle,assessmentType,form,questionId,pairedQuestionId,competencyId,bloomLevel,difficulty,prompt,optionA,optionB,optionC,optionD,correctAnswerLetter,correctAnswerText,rationale,sourceReferences,validationStatus'];
  const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  for (const m of data.modules) {
    if (m.formA.length) {
      const block = moduleHeader(m, 'Formal Pre-Test — Form A') + m.formA.map((q, i) => formatFormal(q, i + 1)).join('');
      master.push(block); formA.push(block);
      m.formA.forEach((q) => csv.push([m.category, m.moduleId, m.moduleTitle, 'formal', 'A', q.questionId, q.pairedQuestionId, q.competencyId, q.bloomLevel, q.difficulty, q.prompt, q.options[0], q.options[1], q.options[2], q.options[3], LETTERS[q.correctIndex], q.options[q.correctIndex], q.rationale, q.sourceReferences.join('; '), q.validationStatus].map(csvEsc).join(',')));
    }
    if (m.formB.length) {
      const block = moduleHeader(m, 'Formal Post-Test — Form B') + m.formB.map((q, i) => formatFormal(q, i + 1)).join('');
      master.push(block); formB.push(block);
      m.formB.forEach((q) => csv.push([m.category, m.moduleId, m.moduleTitle, 'formal', 'B', q.questionId, q.pairedQuestionId, q.competencyId, q.bloomLevel, q.difficulty, q.prompt, q.options[0], q.options[1], q.options[2], q.options[3], LETTERS[q.correctIndex], q.options[q.correctIndex], q.rationale, q.sourceReferences.join('; '), q.validationStatus].map(csvEsc).join(',')));
    }
    if (m.inModule.length) {
      const block = moduleHeader(m, 'In-Module Conceptual Assessment') + m.inModule.map((q, i) => formatInModule(q, i + 1)).join('');
      master.push(block); inMod.push(block);
    }
    if (m.practical) {
      const block = moduleHeader(m, 'Practical C++ Assessment') + formatPractical(m.practical);
      master.push(block); practical.push(block);
    }
  }

  // Audit + counts file.
  const audit = [
    header(data.counts, data.validation, now),
    'PER-CATEGORY MODULE COUNTS:',
    ...Object.entries(data.counts.byCategory).map(([c, n]) => `  ${c}: ${n}`),
    '',
    'PER-MODULE INVENTORY (formA / formB / inModule / practical / status):',
    ...data.modules.map((m) => `  [${m.category}] ${m.moduleId}: ${m.formA.length} / ${m.formB.length} / ${m.inModule.length} / ${m.practical ? 1 : 0} / ${m.status}`),
    '',
    `VALIDATION ERRORS (${data.validation.errors.length}):`,
    ...data.validation.errors.map((e) => `  [${e.code}] ${e.message}`),
    '',
    `VALIDATION WARNINGS (${data.validation.warnings.length}):`,
    ...data.validation.warnings.map((w) => `  [${w.code}] ${w.message}`),
    '',
    `VALIDATION INFO (${data.validation.info.length}):`,
    ...data.validation.info.map((i) => `  [${i.code}] ${i.message}`),
    '',
  ].join('\n');

  await writeFile(resolve(OUT_DIR, 'ALL_QUESTIONS_AND_ANSWERS.txt'), master.join('\n'), 'utf8');
  await writeFile(resolve(OUT_DIR, 'FORMAL_FORM_A_QUESTIONS_AND_ANSWERS.txt'), formA.join('\n'), 'utf8');
  await writeFile(resolve(OUT_DIR, 'FORMAL_FORM_B_QUESTIONS_AND_ANSWERS.txt'), formB.join('\n'), 'utf8');
  await writeFile(resolve(OUT_DIR, 'IN_MODULE_QUESTIONS_AND_ANSWERS.txt'), inMod.join('\n'), 'utf8');
  await writeFile(resolve(OUT_DIR, 'PRACTICAL_TASKS_AND_EXPECTED_EVIDENCE.txt'), practical.join('\n'), 'utf8');
  await writeFile(resolve(OUT_DIR, 'QUESTION_BANK_AUDIT_AND_COUNTS.txt'), audit, 'utf8');
  await writeFile(resolve(OUT_DIR, 'QUESTION_BANK_REVIEW.csv'), csv.join('\n'), 'utf8');

  console.log(`Wrote review files to ${OUT_DIR}`);
  console.log(`Form A: ${data.counts.formA} | Form B: ${data.counts.formB} | In-module: ${data.counts.inModule} | Practical: ${data.counts.practical} | Total: ${data.counts.grandTotal}`);
  console.log(`Validation: ${data.validation.errors.length} errors, ${data.validation.warnings.length} warnings`);
  if (data.validation.errors.length > 0) {
    console.error('BLOCKING validation errors present — review QUESTION_BANK_AUDIT_AND_COUNTS.txt');
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
