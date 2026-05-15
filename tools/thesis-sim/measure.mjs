#!/usr/bin/env node
// Empirical linear-regression harness for the NeoTerritory microservice.
// Synthesizes C++ inputs of increasing size (LOC), invokes the binary,
// captures wall time and peak working-set memory on Windows via PowerShell
// (Start-Process -PassThru), repeats each N a fixed number of times,
// records the median, then fits ordinary least squares y = a*N + b for
// wall_ms and peak_kb. Output: tools/thesis-sim/measurements.csv plus
// tools/thesis-sim/regression.md.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const BIN = process.env.MEASURE_BIN || 'Codebase/Microservice/build-msys/Release/NeoTerritory.exe';
const SAMPLE = process.env.MEASURE_SAMPLE || 'Codebase/Microservice/samples/integration/all_patterns.cpp';
const N_VALUES = (process.env.MEASURE_N || '100,500,1000,2000,5000,10000,20000').split(',').map(Number);
const REPEATS = Number(process.env.MEASURE_REPEATS || 5);
const OUT_CSV = process.env.MEASURE_OUT_CSV || 'tools/thesis-sim/measurements.csv';
const OUT_MD  = process.env.MEASURE_OUT_MD  || 'tools/thesis-sim/regression.md';
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-measure-'));

if (!fs.existsSync(BIN)) {
  console.error(`Binary not found: ${BIN}`);
  process.exit(1);
}
const baseSource = fs.readFileSync(SAMPLE, 'utf8');

function synthesizeInput(targetLines) {
  const baseLines = baseSource.split('\n').length;
  const copies = Math.max(1, Math.ceil(targetLines / baseLines));
  const parts = [];
  for (let i = 0; i < copies; i++) {
    // Rename every top-level identifier so each copy is a fresh translation unit.
    // We rewrite tokens whose names start with the patterns used by the catalog
    // (Singleton, Builder, Factory, Proxy, Composite, Strategy, Observer) by
    // suffixing them with the copy index. Crude but enough to keep the analyzer
    // from collapsing duplicates.
    const renamed = baseSource.replace(/\b(\w*Singleton|\w*Builder|\w*Factory|\w*Proxy|\w*Composite|\w*Strategy|\w*Observer|\w*Service|\w*Manager|\w*Registry|\w*Subject)\b/g, (m) => `${m}_${i}`);
    parts.push(`// --- synthetic copy ${i + 1}/${copies} ---`);
    parts.push(renamed);
  }
  return parts.slice(0, targetLines).join('\n') + '\n';
}

function powershellEscape(s) {
  // Build a single-quoted PowerShell string. Single quotes inside need
  // doubling; everything else is literal.
  return "'" + s.replace(/'/g, "''") + "'";
}

// Write the PS script to a temp file once; pass binary/input/output paths
// via -ArgumentList so quoting stays sane.
const PS_SCRIPT_PATH = path.join(TMP_DIR, 'measure_one.ps1');
fs.writeFileSync(
  PS_SCRIPT_PATH,
  `param(
  [Parameter(Mandatory=$true)][string]$Binary,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [Parameter(Mandatory=$true)][string]$InputFile
)
$ErrorActionPreference = 'Stop'
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Binary
$psi.Arguments = '"--output" "' + $OutDir + '" "' + $InputFile + '"'
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
$peakBytes = 0
while (-not $p.HasExited) {
  try { $p.Refresh() } catch { break }
  if ($p.WorkingSet64 -gt $peakBytes) { $peakBytes = $p.WorkingSet64 }
  Start-Sleep -Milliseconds 5
}
$p.WaitForExit()
if ($p.PeakWorkingSet64 -gt $peakBytes) { $peakBytes = $p.PeakWorkingSet64 }
$wall = ($p.ExitTime - $p.StartTime).TotalMilliseconds
$peakKb = [math]::Round($peakBytes / 1024)
$exit = $p.ExitCode
$p.Dispose()
"$([int]$wall),$peakKb,$exit"
`,
);

function runOnce(inputPath, outDir) {
  const cmd =
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${PS_SCRIPT_PATH}" ` +
    `-Binary "${path.resolve(BIN)}" -OutDir "${path.resolve(outDir)}" -InputFile "${path.resolve(inputPath)}"`;
  const out = execSync(cmd, { encoding: 'utf8' }).trim();
  const lastLine = out.split(/\r?\n/).filter(Boolean).pop() || '';
  const [wallMs, peakKb, exitCode] = lastLine.split(',').map(Number);
  return { wallMs, peakKb, exitCode };
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
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
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

const rows = [];
const measurements = [];

console.log(`[measure] binary=${BIN} sample=${SAMPLE} N=${N_VALUES.join(',')} repeats=${REPEATS}`);
console.log(`[measure] tmp=${TMP_DIR}`);

for (const N of N_VALUES) {
  const syn = synthesizeInput(N);
  const inputPath = path.join(TMP_DIR, `in_${N}.cpp`);
  fs.writeFileSync(inputPath, syn);
  const actualLines = syn.split('\n').length;
  const walls = [];
  const peaks = [];
  for (let r = 0; r < REPEATS; r++) {
    const outDir = path.join(TMP_DIR, `out_${N}_${r}`);
    fs.mkdirSync(outDir, { recursive: true });
    const { wallMs, peakKb, exitCode } = runOnce(inputPath, outDir);
    if (exitCode !== 0) {
      console.warn(`[measure]   N=${N} rep=${r} non-zero exit=${exitCode} (continuing)`);
    }
    walls.push(wallMs);
    peaks.push(peakKb);
    rows.push({ N: actualLines, rep: r, wall_ms: wallMs, peak_kb: peakKb, exit: exitCode });
  }
  const medWall = median(walls);
  const medPeak = median(peaks);
  measurements.push({ N: actualLines, wall_ms_median: medWall, peak_kb_median: medPeak, walls, peaks });
  console.log(`[measure]   N≈${N} (actual ${actualLines}): wall_ms median=${medWall} samples=${walls.join('|')}  peak_kb median=${medPeak} samples=${peaks.join('|')}`);
}

// Write CSV
const csvLines = ['N,rep,wall_ms,peak_kb,exit'];
for (const r of rows) csvLines.push(`${r.N},${r.rep},${r.wall_ms},${r.peak_kb},${r.exit}`);
fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');
console.log(`[measure] wrote ${OUT_CSV} (${rows.length} samples)`);

// Fit OLS on the median values
const xs = measurements.map((m) => m.N);
const wallFit = ols(xs, measurements.map((m) => m.wall_ms_median));
const peakFit = ols(xs, measurements.map((m) => m.peak_kb_median));

const md = [];
md.push('# Empirical Regression — Wall Time and Peak Memory vs Input Size');
md.push('');
md.push(`_Generated ${new Date().toISOString()} on ${os.platform()} ${os.arch()} (${os.cpus()[0]?.model || 'unknown CPU'}, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB RAM)._`);
md.push('');
md.push(`Binary: \`${BIN}\``);
md.push(`Synthesizer base sample: \`${SAMPLE}\``);
md.push(`Repeats per N: **${REPEATS}** (median reported below).`);
md.push('');
md.push('## Median measurements per input size');
md.push('');
md.push('| N (lines, actual) | wall_ms (median) | peak_kb (median) | wall samples | peak samples |');
md.push('|---:|---:|---:|---|---|');
for (const m of measurements) {
  md.push(`| ${m.N} | ${m.wall_ms_median} | ${m.peak_kb_median} | ${m.walls.join(' / ')} | ${m.peaks.join(' / ')} |`);
}
md.push('');
md.push('## Ordinary Least Squares fits');
md.push('');
md.push('| Metric | Slope (per line) | Intercept | R² |');
md.push('|---|---:|---:|---:|');
md.push(`| wall_ms vs N | ${wallFit.slope.toFixed(6)} | ${wallFit.intercept.toFixed(3)} | **${wallFit.r2.toFixed(4)}** |`);
md.push(`| peak_kb vs N | ${peakFit.slope.toFixed(6)} | ${peakFit.intercept.toFixed(3)} | **${peakFit.r2.toFixed(4)}** |`);
md.push('');
md.push('## Interpretation');
md.push('');
md.push('The thesis (Sections 3.4.1 and 3.4.2) claims both wall-time and peak memory grow linearly in the size of the submitted source. If both fits return R² ≥ 0.90 with a positive slope, the empirical evidence supports the linear claim within the range of N tested here.');
md.push('');
md.push(`- wall_ms R² = **${wallFit.r2.toFixed(4)}** — ${wallFit.r2 >= 0.9 ? 'supports' : 'does NOT support'} the linear-time claim.`);
md.push(`- peak_kb R² = **${peakFit.r2.toFixed(4)}** — ${peakFit.r2 >= 0.9 ? 'supports' : 'does NOT support'} the linear-space claim.`);
md.push('');
md.push('Methodology notes: the synthesizer concatenates renamed copies of the base sample to reach the target line count, so the analyzer treats each copy as an independent translation unit. Wall time is `Process.ExitTime − Process.StartTime` on a direct `System.Diagnostics.Process` launch (not `Start-Process`, whose property bag is cleared on some PowerShell versions). Peak memory is sampled every 5 ms via `Process.Refresh()` + `WorkingSet64`, with `Process.PeakWorkingSet64` taken as a fallback maximum after exit. No warm-up runs are discarded — the first invocation is included in the median, since a cold start represents real first-use cost.');
md.push('');
md.push('## Caveats');
md.push('');
md.push('- This is a single-host measurement on the developer workstation, not the AWS Lightsail target. The slope is hardware-specific; the R² (linearity) is the portable signal.');
md.push('- The synthesizer rewrites identifier names so each copy survives semantic analysis; a different choice of base sample would shift the slope but not change the linearity story.');

fs.writeFileSync(OUT_MD, md.join('\n'));
console.log(`[measure] wrote ${OUT_MD}`);

try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* best-effort */ }
