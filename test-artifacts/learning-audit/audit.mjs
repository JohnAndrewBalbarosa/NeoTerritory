// Audit every pattern's codeSketch in patternData.ts against the
// microservice analyzer. Prints PASS / WRONG / NONE per pattern.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const patternDataPath = path.join(root, 'Codebase', 'Frontend', 'src', 'components', 'marketing', 'patterns', 'patternData.ts');
const binary = path.join(root, 'Codebase', 'Microservice', 'build-msys', 'Debug', 'NeoTerritory.exe');
const catalog = path.join(root, 'Codebase', 'Microservice', 'pattern_catalog');
const outRoot = path.join(here, 'runs');
fs.mkdirSync(outRoot, { recursive: true });

const src = fs.readFileSync(patternDataPath, 'utf8');

// Crude parser: split on `slug: '...'` markers; for each block, capture slug,
// family, and the contents of the next `codeSketch: \`...\`` template literal.
const slugRe = /slug:\s*'([^']+)'[\s\S]*?family:\s*'([^']+)'[\s\S]*?codeSketch:\s*`([^`]*)`/g;
const patterns = [];
let m;
while ((m = slugRe.exec(src)) !== null) {
  patterns.push({ slug: m[1], family: m[2], codeSketch: m[3] });
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Mirrors learningModules.ts attachPractical(): route slug → catalog slug.
const ALIAS = { 'factory-method': 'factory' };
// Mirrors NON_DETECTED_QUIZZES: these patterns ship a quiz, not a code check.
const QUIZ_FALLBACK = new Set(['observer','iterator','command','composite','template-method','state','repository']);

function matches(detected, slug) {
  const target = ALIAS[slug] || slug;
  const want = normalize(target);
  for (const d of detected) {
    const id = normalize(d.pattern_id).replace(/^[a-z]+/, '');
    const name = normalize(d.pattern_name);
    if (id === want || name === want) return d;
  }
  return null;
}

console.log(`Found ${patterns.length} patterns. Running analyzer...\n`);
const results = [];

for (const p of patterns) {
  const dir = path.join(outRoot, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  // Wrap in a self-contained translation unit. The microservice analyzer
  // expects valid C++ class declarations; preface with common includes so
  // sketches that mention <vector>, std::string, etc. still parse.
  const preamble = '#include <cstddef>\n#include <memory>\n#include <string>\n#include <vector>\n#include <iostream>\n\n';
  const file = path.join(dir, `${p.slug}.cpp`);
  fs.writeFileSync(file, preamble + p.codeSketch + '\n');

  const r = spawnSync(binary, ['--catalog', catalog, '--output', dir, file], {
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  const reportPath = path.join(dir, 'report.json');
  if (r.status !== 0 || !fs.existsSync(reportPath)) {
    results.push({ slug: p.slug, family: p.family, verdict: 'BINARY_FAIL', detail: (r.stderr || '').trim().slice(0, 200) });
    continue;
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const items = report.stage_metrics?.[0]?.items_processed ?? 0;
  const detected = report.detected_patterns || [];
  if (QUIZ_FALLBACK.has(p.slug)) {
    results.push({ slug: p.slug, family: p.family, verdict: 'QUIZ', detail: 'practical = quiz (no catalog detector)' });
    continue;
  }
  const hit = matches(detected, p.slug);
  if (hit) {
    results.push({ slug: p.slug, family: p.family, verdict: 'PASS', detail: hit.pattern_id });
  } else if (detected.length > 0) {
    results.push({ slug: p.slug, family: p.family, verdict: 'WRONG', detail: detected.map(d => d.pattern_id).join(',') });
  } else {
    results.push({ slug: p.slug, family: p.family, verdict: 'NONE', detail: `items=${items} diags=${(report.diagnostics||[]).map(d=>d.code||d.message).join(';')||'-'}` });
  }
}

const w = (s) => process.stdout.write(s);
w(`\n${'slug'.padEnd(20)} ${'family'.padEnd(12)} ${'verdict'.padEnd(12)} detail\n`);
w('-'.repeat(90) + '\n');
for (const r of results) {
  w(`${r.slug.padEnd(20)} ${r.family.padEnd(12)} ${r.verdict.padEnd(12)} ${r.detail}\n`);
}
const pass = results.filter(r => r.verdict === 'PASS').length;
const quiz = results.filter(r => r.verdict === 'QUIZ').length;
const fail = results.length - pass - quiz;
w(`\nSUMMARY: ${pass} pass (code-detected), ${quiz} quiz (no catalog detector), ${fail} need fixing.\n`);
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(results, null, 2));
