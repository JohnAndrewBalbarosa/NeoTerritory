#!/usr/bin/env node
// Compute Cronbach's alpha across the 30-user thesis-sim fixture and
// emit tools/thesis-sim/reliability.md. Per-respondent rolling rules:
//
//  - Section B per-run items (B.3..B.7) are five ratings per respondent
//    each. Roll to one mean per respondent per item before feeding into
//    the alpha formula — that is the input shape Cronbach's alpha
//    expects (one score per respondent per item).
//  - Section B sign-out items (B.1, B.2, B.8) and Sections C-F use the
//    single session rating per respondent as-is.
//
// Subscales: Functional Suitability (8 items: B.1..B.8 with B.3..B.7
// rolled), Usability (5: C.9..C.13), Performance Efficiency (2: D.14,
// D.15), Reliability (2: E.16, E.17), Security & Data Protection (2:
// F.18, F.19), Overall (all 19 Likert items).

import fs from 'node:fs';

const DATASET = process.argv[2] || 'tools/thesis-sim/dataset.json';
const OUT = process.argv[3] || 'tools/thesis-sim/reliability.md';

const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));

const PER_RUN = ['B.3', 'B.4', 'B.5', 'B.6', 'B.7'];
const SECTIONS = {
  'Functional Suitability (Section B)': ['B.1', 'B.2', 'B.3', 'B.4', 'B.5', 'B.6', 'B.7', 'B.8'],
  'Usability (Section C)':              ['C.9', 'C.10', 'C.11', 'C.12', 'C.13'],
  'Performance Efficiency (Section D)': ['D.14', 'D.15'],
  'Reliability (Section E)':            ['E.16', 'E.17'],
  'Security & Data Protection (Section F)': ['F.18', 'F.19'],
};
const ALL_LIKERT = [
  'B.1', 'B.2', 'B.3', 'B.4', 'B.5', 'B.6', 'B.7', 'B.8',
  'C.9', 'C.10', 'C.11', 'C.12', 'C.13',
  'D.14', 'D.15',
  'E.16', 'E.17',
  'F.18', 'F.19',
];

function meanArr(a) {
  return a.reduce((s, v) => s + v, 0) / a.length;
}
function variance(a) {
  if (a.length < 2) return 0;
  const m = meanArr(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
}

function perRespondentScore(user, key) {
  if (PER_RUN.includes(key)) {
    const ratings = user.runs.map((r) => r.ratings[key]).filter((v) => Number.isFinite(v));
    return ratings.length ? meanArr(ratings) : null;
  }
  const v = user.session_ratings[key];
  return Number.isFinite(v) ? v : null;
}

function cronbachAlpha(items) {
  // items is { key: [score per respondent] }
  const keys = Object.keys(items);
  const k = keys.length;
  if (k < 2) return { alpha: NaN, k, n: 0 };
  const n = items[keys[0]].length;
  for (const key of keys) {
    if (items[key].length !== n) {
      throw new Error(`item ${key} has ${items[key].length} respondents, expected ${n}`);
    }
  }
  let sumItemVar = 0;
  for (const key of keys) sumItemVar += variance(items[key]);
  const totals = [];
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (const key of keys) t += items[key][i];
    totals.push(t);
  }
  const totalVar = variance(totals);
  if (totalVar === 0) return { alpha: NaN, k, n, sumItemVar, totalVar };
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);
  return { alpha, k, n, sumItemVar, totalVar };
}

function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return NaN;
  const mx = meanArr(xs), my = meanArr(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  return dx2 === 0 || dy2 === 0 ? NaN : num / Math.sqrt(dx2 * dy2);
}

function interpret(alpha) {
  if (!Number.isFinite(alpha)) return 'Not computable';
  if (alpha >= 0.90) return 'Excellent';
  if (alpha >= 0.80) return 'Good';
  if (alpha >= 0.70) return 'Acceptable';
  if (alpha >= 0.60) return 'Questionable';
  return 'Poor (instrument needs revision)';
}

function buildItemMatrix(keys) {
  const items = {};
  for (const k of keys) items[k] = [];
  for (const u of dataset.users) {
    for (const k of keys) {
      const v = perRespondentScore(u, k);
      if (v == null) {
        // Drop the respondent entirely for this subscale rather than
        // imputing — keeps the alpha unbiased by missing-rating fills.
        for (const kk of keys) items[kk].pop();
        break;
      }
      items[k].push(v);
    }
  }
  return items;
}

const sectionResults = [];
for (const [name, keys] of Object.entries(SECTIONS)) {
  const items = buildItemMatrix(keys);
  const r = cronbachAlpha(items);
  let interItemR = null;
  if (keys.length === 2) {
    interItemR = pearson(items[keys[0]], items[keys[1]]);
  }
  sectionResults.push({ name, keys, ...r, interItemR });
}

const overallItems = buildItemMatrix(ALL_LIKERT);
const overall = cronbachAlpha(overallItems);

// Markdown report
const lines = [];
lines.push('# Cronbach\'s Alpha — Internal-Consistency Reliability');
lines.push('');
lines.push(`_Generated ${new Date().toISOString()} from \`${DATASET.replaceAll('\\\\', '/')}\` (N = ${dataset.users.length} respondents, ${ALL_LIKERT.length} Likert items)._`);
lines.push('');
lines.push('Per-respondent rolling rule for Section B per-run items (B.3 — B.7): the five ratings collected across the respondent\'s five analysis runs are averaged into one score per item per respondent before being fed into the alpha formula. Section B.1 / B.2 / B.8 and Sections C-F are session-only items used as-is.');
lines.push('');
lines.push('## Per-subscale results');
lines.push('');
lines.push('| Subscale | Items | k | N | α | Interpretation | Inter-item r (k=2 only) |');
lines.push('|---|---|---:|---:|---:|---|---:|');
for (const r of sectionResults) {
  const alphaStr = Number.isFinite(r.alpha) ? r.alpha.toFixed(4) : '—';
  const interItemStr = r.interItemR == null ? '—' : (Number.isFinite(r.interItemR) ? r.interItemR.toFixed(4) : '—');
  lines.push(`| **${r.name}** | ${r.keys.join(', ')} | ${r.k} | ${r.n} | ${alphaStr} | ${interpret(r.alpha)} | ${interItemStr} |`);
}
lines.push('');
lines.push('## Overall instrument');
lines.push('');
lines.push('| Items | k | N | α | Interpretation |');
lines.push('|---|---:|---:|---:|---|');
const overallAlphaStr = Number.isFinite(overall.alpha) ? overall.alpha.toFixed(4) : '—';
lines.push(`| All 19 Likert items (B.1 — F.19) | ${overall.k} | ${overall.n} | **${overallAlphaStr}** | **${interpret(overall.alpha)}** |`);
lines.push('');
lines.push('## Threshold table (interpretation key)');
lines.push('');
lines.push('| α range | Interpretation |');
lines.push('|---|---|');
lines.push('| α ≥ 0.90 | Excellent |');
lines.push('| 0.80 ≤ α < 0.90 | Good |');
lines.push('| 0.70 ≤ α < 0.80 | Acceptable |');
lines.push('| 0.60 ≤ α < 0.70 | Questionable |');
lines.push('| α < 0.60 | Poor (instrument needs revision) |');
lines.push('');
lines.push('## Caveats');
lines.push('');
lines.push('- Two-item subscales (Performance Efficiency, Reliability, Security & Data Protection) report Cronbach\'s α for completeness, but with k = 2 the value is mathematically equivalent to the Spearman-Brown prophecy of the inter-item correlation. The raw inter-item *r* is reported alongside α so the reader can judge the construct without being misled by k = 2 inflation/deflation effects.');
lines.push('- The 30 respondents are simulated (per-persona deterministic generation in `tools/thesis-sim/expand-dataset.mjs`). Persona-level coherence drives some between-item correlation, which is realistic for the kind of user voice the thesis is modelling but means the α value is a property of the simulated cohort, not a substitute for a live empirical reliability study with human respondents.');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
console.log('');
console.log('Per-section summary:');
for (const r of sectionResults) {
  const alphaStr = Number.isFinite(r.alpha) ? r.alpha.toFixed(4) : '—';
  console.log(`  ${r.name.padEnd(40)} k=${r.k} n=${r.n} alpha=${alphaStr} (${interpret(r.alpha)})`);
}
console.log(`  Overall instrument                       k=${overall.k} n=${overall.n} alpha=${Number.isFinite(overall.alpha) ? overall.alpha.toFixed(4) : '—'} (${interpret(overall.alpha)})`);
