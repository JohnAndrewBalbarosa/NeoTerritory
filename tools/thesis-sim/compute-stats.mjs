#!/usr/bin/env node
// Offline roll-up over tools/thesis-sim/dataset.json (or whatever path is
// provided as argv[2]). Emits stats.md with the per-question / per-section
// statistics that the thesis Chapter 4 tables expect.
//
// Usage: node tools/thesis-sim/compute-stats.mjs [datasetPath] [outPath]

import fs from 'node:fs';
import path from 'node:path';

const datasetPath = process.argv[2] || 'tools/thesis-sim/dataset.json';
const outPath     = process.argv[3] || 'tools/thesis-sim/stats.md';

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

const PROFILE_KEYS  = dataset.profileQuestions;
const PER_RUN_KEYS  = dataset.perRunQuestions;
const SESSION_KEYS  = dataset.sessionLikertQuestions;

const PROFILE_LABELS = {
  'A.1': { text: 'Current year level', choices: { 1: 'First year', 2: 'Second year', 3: 'Third year', 4: 'Fourth year', 5: 'Others' } },
  'A.2': { text: 'Programming experience', choices: { 1: 'Less than 1 year', 2: '1–2 years', 3: '3–4 years', 4: 'More than 4 years' } },
  'A.3': { text: 'Familiarity with C++', choices: { 1: 'Not familiar', 2: 'Beginner', 3: 'Intermediate', 4: 'Advanced' } },
  'A.4': { text: 'Familiarity with object-oriented programming', choices: { 1: 'Not familiar', 2: 'Beginner', 3: 'Intermediate', 4: 'Advanced' } },
  'A.5': { text: 'Familiarity with design patterns', choices: { 1: 'Not familiar', 2: 'Beginner', 3: 'Intermediate', 4: 'Advanced' } }
};

const LIKERT_LABELS = {
  'B.1':  'The learning modules help me understand selected software design-pattern concepts.',
  'B.2':  'The examples in the learning modules help me understand how design patterns may appear in code.',
  'B.3':  'The system helps me understand unfamiliar C++ source code.',
  'B.4':  'The system helps me identify important parts of the analyzed code.',
  'B.5':  'The system helps me connect design-pattern concepts to actual C++ code.',
  'B.6':  'The generated documentation helps me understand the structure, purpose, and important parts of the analyzed source code.',
  'B.7':  'The generated unit-test targets or testing focus areas help me recognize possible areas of the analyzed code that may require further checking.',
  'B.8':  'CodiNeo is useful as a learning support tool for DEVCON Luzon interns or novice developers.',
  'C.9':  'The system interface is easy to understand.',
  'C.10': 'It is easy to access and navigate the learning modules.',
  'C.11': 'It is easy to enter, paste, or submit C++ code into the system.',
  'C.12': 'The analysis results are organized clearly.',
  'C.13': 'The detected design-pattern evidence and highlighted code structures are easy to understand.',
  'D.14': 'The system loads, responds, and generates analysis results within an acceptable time.',
  'D.15': 'The system responds quickly enough when I move between learning modules, analysis results, documentation outputs, and questionnaire sections.',
  'E.16': 'The system provides clear feedback when the submitted code cannot be analyzed properly.',
  'E.17': 'The system produces stable results when similar C++ inputs are analyzed.',
  'F.18': 'The system handles submitted code and user responses responsibly.',
  'F.19': 'The system protects user responses and submitted information from unauthorized disclosure.'
};

const SECTION_KEYS = {
  'Functional Suitability':       ['B.1', 'B.2', 'B.3', 'B.4', 'B.5', 'B.6', 'B.7', 'B.8'],
  'Usability':                    ['C.9', 'C.10', 'C.11', 'C.12', 'C.13'],
  'Performance Efficiency':       ['D.14', 'D.15'],
  'Reliability':                  ['E.16', 'E.17'],
  'Security and Data Protection': ['F.18', 'F.19']
};

// Likert verbal interpretation cutoffs derived from the 5-point scale
// with equal-width bands of 0.8: 1.00–1.80, 1.81–2.60, 2.61–3.40,
// 3.41–4.20, 4.21–5.00.
function verbal(mean) {
  if (mean >= 4.21) return 'Strongly Agree';
  if (mean >= 3.41) return 'Agree';
  if (mean >= 2.61) return 'Neutral';
  if (mean >= 1.81) return 'Disagree';
  return 'Strongly Disagree';
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function freq(arr) {
  const f = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of arr) if (f[v] !== undefined) f[v] += 1;
  return f;
}

// ----- gather observations -----
const perRunByKey  = Object.fromEntries(PER_RUN_KEYS.map(k => [k, []]));
const sessionByKey = Object.fromEntries(SESSION_KEYS.map(k => [k, []]));
const profileByKey = Object.fromEntries(PROFILE_KEYS.map(k => [k, []]));

const personaCounts = {};
let totalPerRunObservations = 0;
let totalSessionObservations = 0;

for (const u of dataset.users) {
  personaCounts[u.persona] = (personaCounts[u.persona] || 0) + 1;
  for (const k of PROFILE_KEYS) profileByKey[k].push(u.profile[k]);
  for (const run of u.runs) {
    for (const k of PER_RUN_KEYS) {
      perRunByKey[k].push(run.ratings[k]);
      totalPerRunObservations += 1;
    }
  }
  for (const k of SESSION_KEYS) {
    sessionByKey[k].push(u.session_ratings[k]);
    totalSessionObservations += 1;
  }
}

// ----- markdown out -----
const lines = [];
lines.push('# Thesis Simulation — Computed Statistics');
lines.push('');
lines.push(`_Generated from \`${path.relative(process.cwd(), datasetPath).replaceAll('\\\\', '/')}\` on ${new Date().toISOString()}_`);
lines.push('');
lines.push(`Instrument version: **${dataset.instrumentVersion}**. Respondents (N): **${dataset.users.length}**. Per-run observations: **${totalPerRunObservations}** total Likert ratings (5 items × ${dataset.users.length} testers × 5 runs). Sign-out Likert observations: **${totalSessionObservations}** total ratings (14 items × ${dataset.users.length} testers).`);
lines.push('');

lines.push('## Persona spread (simulation-only metadata)');
lines.push('');
lines.push('| Persona | Count |');
lines.push('|---|---:|');
for (const [p, c] of Object.entries(personaCounts).sort((a, b) => b[1] - a[1])) {
  lines.push(`| \`${p}\` | ${c} |`);
}
lines.push('');

lines.push('## Section A — Respondent Profile (frequency)');
lines.push('');
for (const k of PROFILE_KEYS) {
  const meta = PROFILE_LABELS[k];
  const f = freq(profileByKey[k]);
  lines.push(`### ${k} — ${meta.text}`);
  lines.push('');
  lines.push('| Choice | n | % |');
  lines.push('|---|---:|---:|');
  for (const [val, label] of Object.entries(meta.choices)) {
    const n = f[val] || 0;
    const pct = (n / dataset.users.length * 100).toFixed(1);
    lines.push(`| ${val} — ${label} | ${n} | ${pct}% |`);
  }
  lines.push('');
}

function questionTable(title, keys, byKey) {
  lines.push(`## ${title}`);
  lines.push('');
  lines.push('| Item | N | Mean | SD | 1 | 2 | 3 | 4 | 5 | Verbal Interpretation |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const k of keys) {
    const arr = byKey[k];
    const m = mean(arr);
    const sd = stdev(arr);
    const f = freq(arr);
    lines.push(`| **${k}** ${LIKERT_LABELS[k]} | ${arr.length} | ${m.toFixed(2)} | ${sd.toFixed(2)} | ${f[1]} | ${f[2]} | ${f[3]} | ${f[4]} | ${f[5]} | ${verbal(m)} |`);
  }
  lines.push('');
}

questionTable('Per-run survey — items B.3–B.7 (one row per analysis)', PER_RUN_KEYS, perRunByKey);
questionTable('Sign-out survey — Likert items', SESSION_KEYS, sessionByKey);

lines.push('## Per-section weighted means');
lines.push('');
lines.push('Each section combines its per-run items (50 observations each) with its sign-out items (10 observations each). The weighted mean is the sum-of-ratings divided by the total observation count across all items in the section.');
lines.push('');
lines.push('| Section | Items | Total observations | Sum of ratings | Weighted mean | Verbal Interpretation |');
lines.push('|---|---|---:|---:|---:|---|');
for (const [section, keys] of Object.entries(SECTION_KEYS)) {
  let sum = 0;
  let count = 0;
  const itemsList = [];
  for (const k of keys) {
    itemsList.push(k);
    const arr = PER_RUN_KEYS.includes(k) ? perRunByKey[k] : sessionByKey[k];
    for (const v of arr) { sum += v; count += 1; }
  }
  const wm = sum / count;
  lines.push(`| **${section}** | ${itemsList.join(', ')} | ${count} | ${sum} | ${wm.toFixed(2)} | ${verbal(wm)} |`);
}
lines.push('');

lines.push('## Verbal interpretation cutoffs (5-point Likert)');
lines.push('');
lines.push('| Range | Interpretation |');
lines.push('|---|---|');
lines.push('| 4.21 – 5.00 | Strongly Agree |');
lines.push('| 3.41 – 4.20 | Agree |');
lines.push('| 2.61 – 3.40 | Neutral |');
lines.push('| 1.81 – 2.60 | Disagree |');
lines.push('| 1.00 – 1.80 | Strongly Disagree |');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${outPath} (${lines.length} lines).`);
