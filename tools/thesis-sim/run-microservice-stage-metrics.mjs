#!/usr/bin/env node
// Run the local microservice binary against every sample under
// Codebase/Microservice/samples and aggregate the report.json
// stage_metrics it emits. Each run is repeated REPEATS times and the
// median ms-per-stage and items_processed are reported.
//
// This is the AUTHORITATIVE per-stage timing the thesis worst-case
// analysis should cite: it isolates the algorithm itself from network
// RTT, Express middleware, AI commentary, and JSON serialization in
// the HTTP path.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const BIN = process.env.MEASURE_BIN || 'Codebase/Microservice/build-msys/Release/NeoTerritory.exe';
const SAMPLE_ROOT = 'Codebase/Microservice/samples';
const REPEATS = Number(process.env.MEASURE_REPEATS || 7);
const OUT_MD = process.env.MEASURE_OUT_MD || 'tools/thesis-sim/stage-metrics.md';
const OUT_CSV = process.env.MEASURE_OUT_CSV || 'tools/thesis-sim/stage-metrics.csv';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-stage-'));

const SAMPLES = [
  'negative/plain_class_no_pattern.cpp',
  'wrapping/logging_proxy.cpp',
  'singleton/config_registry.cpp',
  'factory/shape_factory.cpp',
  'method_chaining/query_predicate.cpp',
  'pimpl/pimpl_basic.cpp',
  'builder/http_request_builder.cpp',
  'strategy/strategy_basic.cpp',
  'usages/usages_basic.cpp',
  'mixed/mixed_classes.cpp',
  'integration/all_patterns.cpp',
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}
function countTokens(filePath) {
  // Rough proxy: alphanumeric + punctuation runs separated by whitespace.
  return fs.readFileSync(filePath, 'utf8').match(/\S+/g)?.length ?? 0;
}

const CATALOG = path.resolve('Codebase/Microservice/pattern_catalog');

function runOnce(samplePath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const cmd = `"${path.resolve(BIN)}" --catalog "${CATALOG}" --output "${path.resolve(outDir)}" "${path.resolve(samplePath)}"`;
  execSync(cmd, { stdio: 'pipe' });
  const reportPath = path.join(outDir, 'report.json');
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}
function ols(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (ys[i] - meanY); denX += (xs[i] - meanX) ** 2; }
  const slope = denX === 0 ? 0 : num / denX;
  const intercept = meanY - slope * meanX;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = slope * xs[i] + intercept;
    ssRes += (ys[i] - yHat) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

const STAGES = ['analysis', 'trees', 'pattern_dispatch', 'hashing'];
const rows = [];

console.log(`[stage-metrics] binary=${BIN} repeats=${REPEATS}`);

// --------- synthetic-size sweep (concat the integration sample N copies) ---------
function synthesize(targetLines) {
  const base = fs.readFileSync(path.join(SAMPLE_ROOT, 'integration/all_patterns.cpp'), 'utf8');
  const baseLines = base.split('\n').length;
  const copies = Math.max(1, Math.ceil(targetLines / baseLines));
  const parts = [];
  for (let i = 0; i < copies; i++) {
    const renamed = base.replace(/\b(\w*Singleton|\w*Builder|\w*Factory|\w*Proxy|\w*Composite|\w*Strategy|\w*Observer|\w*Service|\w*Manager|\w*Registry|\w*Subject|\w*Logger|\w*Shape|\w*Predicate|\w*Widget)\b/g, (m) => `${m}_${i}`);
    parts.push(`// synthetic copy ${i + 1}/${copies}`);
    parts.push(renamed);
  }
  return parts.join('\n') + '\n';
}

const SYNTH_NS = (process.env.SYNTH_NS || '500,1000,2000,5000,10000,20000').split(',').map(Number);
const SYNTH_RESULTS = [];
console.log('[stage-metrics] running synthetic sweep…');
for (const N of SYNTH_NS) {
  const src = synthesize(N);
  const inPath = path.join(TMP, `synth_${N}.cpp`);
  fs.writeFileSync(inPath, src);
  const actual = src.split('\n').length;
  const perStage = Object.fromEntries(STAGES.map((s) => [s, []]));
  const perStageItems = Object.fromEntries(STAGES.map((s) => [s, []]));
  let detected = 0;
  for (let r = 0; r < REPEATS; r++) {
    const out = path.join(TMP, `synth_${N}_${r}`);
    let rep;
    try { rep = runOnce(inPath, out); }
    catch (e) { console.warn(`[err] synth N=${N} rep=${r}: ${e.message}`); continue; }
    for (const m of (rep.stage_metrics || [])) {
      if (perStage[m.stage_name]) {
        perStage[m.stage_name].push(m.milliseconds);
        perStageItems[m.stage_name].push(m.items_processed);
      }
    }
    detected = rep.detected_patterns?.length ?? detected;
  }
  const stageMs = Object.fromEntries(STAGES.map((s) => [s, median(perStage[s]) ?? 0]));
  const stageItems = Object.fromEntries(STAGES.map((s) => [s, median(perStageItems[s]) ?? 0]));
  const totalMs = STAGES.reduce((a, s) => a + stageMs[s], 0);
  SYNTH_RESULTS.push({ N: actual, stageMs, stageItems, totalMs, detected });
  console.log(`  synth N=${actual}: total=${totalMs}ms (analysis=${stageMs.analysis}, trees=${stageMs.trees}, dispatch=${stageMs.pattern_dispatch}, hashing=${stageMs.hashing}) detected=${detected}`);
}

const perSampleAgg = [];
for (const sample of SAMPLES) {
  const full = path.join(SAMPLE_ROOT, sample);
  if (!fs.existsSync(full)) { console.log(`[skip] missing ${full}`); continue; }
  const lines = countLines(full);
  const toks = countTokens(full);
  const perStage = Object.fromEntries(STAGES.map((s) => [s, []]));
  const perStageItems = Object.fromEntries(STAGES.map((s) => [s, []]));
  let detected = 0, doc = 0, ut = 0;
  for (let r = 0; r < REPEATS; r++) {
    const out = path.join(TMP, `${path.basename(sample, '.cpp')}_${r}`);
    let rep;
    try { rep = runOnce(full, out); }
    catch (e) { console.warn(`[err] ${sample} rep=${r}: ${e.message}`); continue; }
    for (const m of (rep.stage_metrics || [])) {
      if (perStage[m.stage_name]) {
        perStage[m.stage_name].push(m.milliseconds);
        perStageItems[m.stage_name].push(m.items_processed);
      }
    }
    detected = rep.detected_patterns?.length ?? rep.detected_patterns ?? detected;
    doc = rep.documentation_target_count ?? doc;
    ut = rep.unit_test_target_count ?? ut;
  }
  const stageMs = Object.fromEntries(STAGES.map((s) => [s, median(perStage[s]) ?? 0]));
  const stageItems = Object.fromEntries(STAGES.map((s) => [s, median(perStageItems[s]) ?? 0]));
  const totalMs = STAGES.reduce((a, s) => a + stageMs[s], 0);
  perSampleAgg.push({ sample, lines, tokens: toks, stageMs, stageItems, totalMs, detected, doc, ut });
  console.log(`  ${sample.padEnd(48)} lines=${lines.toString().padStart(4)} toks=${toks.toString().padStart(5)} total=${totalMs}ms (analysis=${stageMs.analysis}, trees=${stageMs.trees}, dispatch=${stageMs.pattern_dispatch}, hashing=${stageMs.hashing}) detected=${detected}`);
  rows.push({ sample, lines, tokens: toks, ...Object.fromEntries(STAGES.map((s) => [`${s}_ms`, stageMs[s]])), ...Object.fromEntries(STAGES.map((s) => [`${s}_items`, stageItems[s]])), total_ms: totalMs, detected_patterns: detected, doc_targets: doc, unit_test_targets: ut });
}

// OLS on total_ms vs lines, and total_ms vs tokens.
const xsLines = perSampleAgg.map((p) => p.lines);
const xsTokens = perSampleAgg.map((p) => p.tokens);
const ysTotal = perSampleAgg.map((p) => p.totalMs);
const fitLines = ols(xsLines, ysTotal);
const fitTokens = ols(xsTokens, ysTotal);

// Per-stage fits
const perStageFits = {};
for (const stage of STAGES) {
  const ys = perSampleAgg.map((p) => p.stageMs[stage]);
  perStageFits[stage] = ols(xsLines, ys);
}

// CSV
const header = ['sample', 'lines', 'tokens', ...STAGES.map((s) => `${s}_ms`), ...STAGES.map((s) => `${s}_items`), 'total_ms', 'detected_patterns', 'doc_targets', 'unit_test_targets'];
const csvLines = [header.join(',')];
for (const r of rows) csvLines.push(header.map((h) => r[h] ?? 0).join(','));
fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');
console.log(`[stage-metrics] wrote ${OUT_CSV}`);

// MD
const md = [];
md.push('# Microservice Stage Metrics — Real Per-Stage Timing');
md.push('');
md.push(`_Generated ${new Date().toISOString()}. Binary: \`${BIN}\`. Repeats per sample: **${REPEATS}** (median reported)._`);
md.push('');
md.push('This is the authoritative per-stage timing the thesis worst-case analysis should cite: it isolates the C++ analyzer (lexical → trees → pattern_dispatch → hashing) from network RTT, Express middleware, AI commentary, and JSON serialization in the HTTP path. The numbers come from the microservice\'s own `report.json` `stage_metrics` array.');
md.push('');
md.push('## Median per-sample stage timings');
md.push('');
md.push('| Sample | Lines | Tokens | analysis (ms) | trees (ms) | pattern_dispatch (ms) | hashing (ms) | total (ms) | detected | doc tgt | ut tgt |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const p of perSampleAgg) {
  md.push(`| \`${p.sample}\` | ${p.lines} | ${p.tokens} | ${p.stageMs.analysis} | ${p.stageMs.trees} | ${p.stageMs.pattern_dispatch} | ${p.stageMs.hashing} | **${p.totalMs}** | ${p.detected} | ${p.doc} | ${p.ut} |`);
}
md.push('');
md.push('## OLS regression on total_ms vs input size');
md.push('');
md.push('| Predictor | Slope | Intercept | R² |');
md.push('|---|---:|---:|---:|');
md.push(`| total_ms vs lines  | ${fitLines.slope.toFixed(4)} ms/line | ${fitLines.intercept.toFixed(2)} | **${fitLines.r2.toFixed(4)}** |`);
md.push(`| total_ms vs tokens | ${fitTokens.slope.toFixed(4)} ms/tok | ${fitTokens.intercept.toFixed(2)} | **${fitTokens.r2.toFixed(4)}** |`);
md.push('');
md.push('## Per-stage regression vs lines');
md.push('');
md.push('| Stage | Slope (ms/line) | Intercept (ms) | R² |');
md.push('|---|---:|---:|---:|');
for (const s of STAGES) {
  const f = perStageFits[s];
  md.push(`| ${s} | ${f.slope.toFixed(4)} | ${f.intercept.toFixed(2)} | ${f.r2.toFixed(4)} |`);
}
md.push('');
md.push('## Items-processed per stage (proxy for retained-objects space)');
md.push('');
md.push('| Sample | analysis | trees | pattern_dispatch | hashing |');
md.push('|---|---:|---:|---:|---:|');
for (const p of perSampleAgg) {
  md.push(`| \`${p.sample}\` | ${p.stageItems.analysis} | ${p.stageItems.trees} | ${p.stageItems.pattern_dispatch} | ${p.stageItems.hashing} |`);
}
md.push('');
md.push('## Synthetic-size sweep — stage timing scales with input');
md.push('');
md.push('The fixed-sample table above is dominated by the ~10 ms catalog-load floor of the `analysis` stage, so the millisecond timer cannot resolve per-stage scaling at those sizes. The sweep below concatenates renamed copies of `integration/all_patterns.cpp` to reach progressively larger N (lines) so each stage spends measurable time and the slope becomes visible.');
md.push('');
md.push('| N (lines) | analysis (ms) | trees (ms) | pattern_dispatch (ms) | hashing (ms) | total (ms) | detected patterns |');
md.push('|---:|---:|---:|---:|---:|---:|---:|');
for (const r of SYNTH_RESULTS) {
  md.push(`| ${r.N} | ${r.stageMs.analysis} | ${r.stageMs.trees} | ${r.stageMs.pattern_dispatch} | ${r.stageMs.hashing} | **${r.totalMs}** | ${r.detected} |`);
}
md.push('');
const sx = SYNTH_RESULTS.map((r) => r.N);
const sy = SYNTH_RESULTS.map((r) => r.totalMs);
const synthFit = ols(sx, sy);
const synthPerStage = Object.fromEntries(STAGES.map((s) => [s, ols(sx, SYNTH_RESULTS.map((r) => r.stageMs[s]))]));
const synthDetected = ols(sx, SYNTH_RESULTS.map((r) => r.detected));
md.push('OLS fits on the synthetic sweep:');
md.push('');
md.push('| Predictor (synthetic N=' + SYNTH_NS.join('/') + ') | Slope (ms/line) | Intercept (ms) | R² |');
md.push('|---|---:|---:|---:|');
md.push(`| **total_ms vs N** | ${synthFit.slope.toFixed(4)} | ${synthFit.intercept.toFixed(2)} | **${synthFit.r2.toFixed(4)}** |`);
for (const s of STAGES) {
  const f = synthPerStage[s];
  md.push(`| ${s}_ms vs N | ${f.slope.toFixed(4)} | ${f.intercept.toFixed(2)} | ${f.r2.toFixed(4)} |`);
}
md.push(`| detected_patterns vs N | ${synthDetected.slope.toFixed(4)} | ${synthDetected.intercept.toFixed(2)} | ${synthDetected.r2.toFixed(4)} |`);
md.push('');
md.push('## Methodology notes');
md.push('');
md.push(`- Numbers are pulled from \`report.json\` written by \`run_output_stage\` (see \`Codebase/Microservice/Modules/Source/OutputGeneration/Render/codebase_output_writer.cpp:101\` which serialises each \`StageMetric\` as \`{stage_name, milliseconds, items_processed}\`).`);
md.push(`- The microservice does NOT yet self-report peak memory; "items_processed" per stage is the closest proxy for retained-objects space and is included above for completeness.`);
md.push(`- The HTTP/end-to-end timings in \`tools/thesis-sim/regression.md\` (synthetic local sweep up to N=20,000 lines) and the AWS soak latencies are complementary: this report measures the algorithm itself, the other two measure the user-observable time including network and platform overhead.`);

fs.writeFileSync(OUT_MD, md.join('\n'));
console.log(`[stage-metrics] wrote ${OUT_MD}`);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
