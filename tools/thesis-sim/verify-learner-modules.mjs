#!/usr/bin/env node
// Smoke-check that every learning module declared in
// Codebase/Frontend/src/data/learningModules.ts ends up with a practical
// (quiz or pattern code-check) attached. The practical is what the
// PatternsLearnPage's linear unlock gate keys off of, so a missing one
// silently locks every module after it.
//
// This script does NOT run the actual TS — it parses the file textually
// to enumerate the data the attachPractical function consumes, then
// simulates the same matching logic. Output is a markdown table to
// tools/thesis-sim/learner-module-practical-coverage.md.

import fs from 'node:fs';

const SRC_LEARN = 'Codebase/Frontend/src/data/learningModules.ts';
const SRC_PATTERN = 'Codebase/Frontend/src/components/marketing/patterns/patternData.ts';
const OUT = 'tools/thesis-sim/learner-module-practical-coverage.md';

const learnSrc = fs.readFileSync(SRC_LEARN, 'utf8');
const patternSrc = fs.readFileSync(SRC_PATTERN, 'utf8');

// ---- pull the literal sets out of learningModules.ts -----------------------

function extractIds(src, lhsRegex) {
  const m = src.match(lhsRegex);
  if (!m) return new Set();
  return new Set(
    [...m[1].matchAll(/'([^']+)'/g)].map((mm) => mm[1])
  );
}

function extractKeys(src, lhsRegex) {
  const m = src.match(lhsRegex);
  if (!m) return new Set();
  // Object literal keys can be either bareword (`observer:`) or quoted
  // (`'template-method':`). Match both.
  const block = m[1];
  const keys = new Set();
  for (const mm of block.matchAll(/^\s+'([^']+)'\s*:/gm)) keys.add(mm[1]);
  for (const mm of block.matchAll(/^\s+([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:\s*\{/gm)) keys.add(mm[1]);
  return keys;
}

const detectedSlugs = extractIds(
  learnSrc,
  /DETECTED_PATTERN_SLUGS\s*=\s*new\s+Set<string>\(\[([\s\S]*?)\]\)/m,
);
const nonDetectedQuizSlugs = extractKeys(
  learnSrc,
  /NON_DETECTED_QUIZZES\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)^\};/m,
);
const foundationsQuizIds = extractKeys(
  learnSrc,
  /FOUNDATIONS_QUIZZES\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)^\};/m,
);
const aliases = {};
const aliasMatch = learnSrc.match(/PATTERN_SLUG_ALIAS\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)^\};/m);
if (aliasMatch) {
  for (const e of aliasMatch[1].matchAll(/'([^']+)'\s*:\s*\{\s*slug:\s*'([^']+)'/g)) {
    aliases[e[1]] = e[2];
  }
}

// ---- pull all foundation module ids out of FOUNDATIONS_MODULES -------------

const foundationsIds = [...learnSrc.matchAll(/id:\s*'(foundations-[a-z-]+)'/g)].map((m) => m[1]);

// ---- pull all pattern slugs out of patternData.ts --------------------------

const patternSlugs = [...patternSrc.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
const patternFamilies = {};
let curSlug = null;
for (const line of patternSrc.split('\n')) {
  const slugM = line.match(/slug:\s*'([^']+)'/);
  if (slugM) curSlug = slugM[1];
  const famM = line.match(/family:\s*'([^']+)'/);
  if (famM && curSlug) { patternFamilies[curSlug] = famM[1]; curSlug = null; }
}

// ---- replicate attachPractical from learningModules.ts ---------------------

function attachPracticalFor(moduleId, category) {
  if (category === 'foundations') {
    return foundationsQuizIds.has(moduleId)
      ? { kind: 'quiz', source: 'FOUNDATIONS_QUIZZES' }
      : { kind: 'none', source: '— none configured —' };
  }
  // pattern modules: id is `${category}-${pattern.slug}`
  const slug = moduleId.replace(/^[a-z]+-/, '');
  if (nonDetectedQuizSlugs.has(slug)) {
    return { kind: 'quiz', source: 'NON_DETECTED_QUIZZES' };
  }
  const detectionSlug = aliases[slug] || slug;
  if (detectedSlugs.has(detectionSlug)) {
    return { kind: 'pattern', source: `DETECTED_PATTERN_SLUGS (slug=${detectionSlug})` };
  }
  return { kind: 'none', source: `— neither DETECTED nor NON_DETECTED — slug='${slug}' alias='${detectionSlug}' —` };
}

// ---- walk modules + report -------------------------------------------------

const lines = [];
lines.push('# Learning Module Practical Coverage');
lines.push('');
lines.push(`_Generated ${new Date().toISOString()} from \`${SRC_LEARN}\` and \`${SRC_PATTERN}\`._`);
lines.push('');
lines.push('Every module in the linear-unlock chain must declare a `practical` (quiz or pattern code-check). A missing practical silently locks every module after it because `PatternsLearnPage:computeUnlockedCount` requires `completedIds.has(modules[i-1].id)` and that flag is only set when the practical passes.');
lines.push('');
lines.push('## Foundations modules');
lines.push('');
lines.push('| Module ID | Practical kind | Source |');
lines.push('|---|---|---|');
let foundationMissing = 0;
for (const id of foundationsIds) {
  const r = attachPracticalFor(id, 'foundations');
  if (r.kind === 'none') foundationMissing += 1;
  lines.push(`| \`${id}\` | ${r.kind} | ${r.source} |`);
}
lines.push('');
lines.push('## Pattern modules');
lines.push('');
lines.push('| Pattern slug | Module ID | Family | Practical kind | Source |');
lines.push('|---|---|---|---|---|');
let patternMissing = 0;
let patternMissingNames = [];
for (const slug of patternSlugs) {
  const fam = patternFamilies[slug];
  if (!fam) continue;
  const moduleId = `${fam.toLowerCase()}-${slug}`;
  const r = attachPracticalFor(moduleId, fam.toLowerCase());
  if (r.kind === 'none') {
    patternMissing += 1;
    patternMissingNames.push(slug);
  }
  lines.push(`| ${slug} | \`${moduleId}\` | ${fam} | ${r.kind} | ${r.source} |`);
}
lines.push('');
lines.push('## Coverage summary');
lines.push('');
lines.push(`- Foundations modules without a practical: **${foundationMissing}** of ${foundationsIds.length}`);
lines.push(`- Pattern modules without a practical: **${patternMissing}** of ${patternSlugs.length}`);
if (patternMissing > 0) {
  lines.push('');
  lines.push(`**Missing pattern practicals:** ${patternMissingNames.map((s) => '`' + s + '`').join(', ')}.`);
  lines.push('To fix, either add the slug to DETECTED_PATTERN_SLUGS (if the analyser detects it) or add a quiz fallback to NON_DETECTED_QUIZZES in learningModules.ts.');
} else {
  lines.push('');
  lines.push('**Verdict: all pattern modules have a practical configured.** The linear unlock chain is unbroken.');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
console.log('');
for (const ln of lines.slice(-10)) console.log(ln);
