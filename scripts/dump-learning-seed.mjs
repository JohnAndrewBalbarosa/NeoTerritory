#!/usr/bin/env node
// Generate Codebase/Backend/src/db/seeds/learningModules.seed.json from the
// frontend's LEARNING_MODULES (the canonical content + ordering). This is the
// ONLY place the seed content originates — it is NOT hand-copied; the script
// executes the real TS module so the seed can never drift from the frontend.
//
// D92: the seeded module_id set MUST equal the LEARNING_MODULES id set exactly
// (learner progress is keyed to these). sortOrder = the module's index in
// LEARNING_MODULES so the linear unlock gate keeps its current order.
//
// Why a bundle-then-import dance: learningModules.ts imports patternData.ts
// (browser-targeted TS, no Node CJS build). We cannot `import` the .ts directly
// in Node, and the backend deliberately does not take a cross-package TS import.
// esbuild (present in the Frontend node_modules) bundles the entry + its single
// transitive import into a temp ESM file we then dynamically import. No DOM or
// browser-only API is touched by the data module, so the bundle runs in Node.
//
// Usage (from Codebase/Backend): npm run dump:learning-seed
//   or directly:                 node ../../scripts/dump-learning-seed.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const ENTRY = resolve(REPO_ROOT, 'Codebase/Frontend/src/data/learningModules.ts');
const OUT_FILE = resolve(
  REPO_ROOT,
  'Codebase/Backend/src/db/seeds/learningModules.seed.json',
);

// Resolve esbuild from the Frontend workspace (where vite ships it).
const requireFromFrontend = createRequire(
  pathToFileURL(resolve(REPO_ROOT, 'Codebase/Frontend/package.json')),
);

async function loadLearningModules() {
  let esbuild;
  try {
    esbuild = requireFromFrontend('esbuild');
  } catch (err) {
    throw new Error(
      'esbuild not found in Codebase/Frontend/node_modules — run `npm install` in Codebase/Frontend first. ' +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;

  const tmpFile = resolve(os.tmpdir(), `nt-learning-seed-${Date.now()}.mjs`);
  await writeFile(tmpFile, code, 'utf8');
  try {
    const mod = await import(pathToFileURL(tmpFile).href);
    return mod.LEARNING_MODULES;
  } finally {
    await rm(tmpFile, { force: true });
  }
}

// Map a LearningModule (frozen wire shape) → a seed row. moduleId = the module's
// id UNCHANGED; sortOrder = its index in LEARNING_MODULES. Optional sub-objects
// are passed through as-is (the seeder JSON-stringifies them).
function toSeedRow(mod, index) {
  return {
    moduleId: mod.id,
    category: mod.category,
    title: mod.title,
    eyebrow: mod.eyebrow ?? '',
    intro: mod.intro ?? '',
    sections: mod.sections ?? [],
    keyTerms: mod.keyTerms ?? [],
    summary: mod.summary ?? null,
    seeAlso: mod.seeAlso ?? [],
    theoreticalExam: mod.theoreticalExam ?? null,
    practicalExam: mod.practicalExam ?? null,
    sortOrder: index,
  };
}

async function main() {
  const modules = await loadLearningModules();
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error('LEARNING_MODULES did not resolve to a non-empty array');
  }

  const rows = modules.map(toSeedRow);

  // Guardrail: ids must be unique + non-empty. The Vitest parity test enforces
  // this again on the written file, but failing fast here is friendlier.
  const ids = rows.map((r) => r.moduleId);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error('Duplicate module ids in LEARNING_MODULES — refusing to write seed');
  }
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new Error('Empty/non-string module id in LEARNING_MODULES — refusing to write seed');
  }

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(rows, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[dump:learning-seed] wrote ${rows.length} modules → ${OUT_FILE}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[dump:learning-seed] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
