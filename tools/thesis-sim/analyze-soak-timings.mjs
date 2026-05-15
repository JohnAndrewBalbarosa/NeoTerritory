#!/usr/bin/env node
// Read every soak-runs JSONL file and produce a regression of
// /api/analyze latency vs source-line count for the five samples the
// simulator rotated through. This gives an empirical curve grounded in
// REAL end-to-end HTTP traffic against the AWS deployment (browser →
// Express → microservice → Express → browser), as opposed to the
// synthetic local microservice regression in regression.md.

import fs from 'node:fs';
import path from 'node:path';

const SOAK_DIR = 'test-artifacts/soak-runs';
const SAMPLE_LINES = {
  'singleton/config_registry.cpp':    33,
  'builder/http_request_builder.cpp': 50,
  'factory/shape_factory.cpp':        39,
  'wrapping/logging_proxy.cpp':       31,
  'integration/all_patterns.cpp':    131,
};

const samples = Object.fromEntries(Object.keys(SAMPLE_LINES).map((s) => [s, []]));

for (const f of fs.readdirSync(SOAK_DIR).filter((x) => x.endsWith('.jsonl'))) {
  const full = path.join(SOAK_DIR, f);
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.endpoint === '/api/analyze' && row.status === 200 && row.sample && row.latencyMs > 0) {
      if (samples[row.sample]) samples[row.sample].push(row.latencyMs);
    }
  }
}

function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const median = s[s.length >> 1];
  const p95 = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
  return { n: s.length, min: s[0], max: s[s.length - 1], median, mean: Math.round(mean), p95 };
}

function ols(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0;
  for (let i = 0; i < n; i++) {
    num  += (xs[i] - meanX) * (ys[i] - meanY);
    denX += (xs[i] - meanX) ** 2;
  }
  const slope = num / denX;
  const intercept = meanY - slope * meanX;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = slope * xs[i] + intercept;
    ssRes += (ys[i] - yHat) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot, n };
}

console.log('Per-sample latency (ms) on /api/analyze across all soak runs against AWS:');
console.log();
console.log('| Sample | Lines | N | min | median | mean | p95 | max |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
const points = [];
for (const [sample, arr] of Object.entries(samples)) {
  const s = stats(arr);
  const lines = SAMPLE_LINES[sample];
  console.log(`| \`${sample}\` | ${lines} | ${s.n} | ${s.min ?? '—'} | ${s.median ?? '—'} | ${s.mean ?? '—'} | ${s.p95 ?? '—'} | ${s.max ?? '—'} |`);
  if (s.n > 0) points.push({ lines, median: s.median, all: arr });
}

console.log();
const xs = points.map((p) => p.lines);
const yMedian = points.map((p) => p.median);
const fitMedian = ols(xs, yMedian);

// Also fit against the full point cloud (one row per call, not median)
const xsAll = [];
const ysAll = [];
for (const p of points) for (const y of p.all) { xsAll.push(p.lines); ysAll.push(y); }
const fitAll = ols(xsAll, ysAll);

console.log(`OLS fit on per-sample medians (5 points): slope ≈ ${fitMedian.slope.toFixed(3)} ms/line, intercept ≈ ${fitMedian.intercept.toFixed(1)} ms, R² = ${fitMedian.r2.toFixed(4)}`);
console.log(`OLS fit on every individual call (${fitAll.n} points): slope ≈ ${fitAll.slope.toFixed(3)} ms/line, intercept ≈ ${fitAll.intercept.toFixed(1)} ms, R² = ${fitAll.r2.toFixed(4)}`);
