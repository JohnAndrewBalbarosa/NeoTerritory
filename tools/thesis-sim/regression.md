# Empirical Regression — Wall Time and Peak Memory vs Input Size

_Generated 2026-05-16T00:41:53.617Z on win32 x64 (AMD Ryzen 5 2500U with Radeon Vega Mobile Gfx  , 7.6 GB RAM)._

Binary: `Codebase/Microservice/build-msys/Release/NeoTerritory.exe`
Synthesizer base sample: `Codebase/Microservice/samples/integration/all_patterns.cpp`
Repeats per N: **5** (median reported below).

## Median measurements per input size

| N (lines, actual) | wall_ms (median) | peak_kb (median) | wall samples | peak samples |
|---:|---:|---:|---|---|
| 267 | 56 | 2432 | 54 / 52 / 58 / 57 / 56 | 3620 / 2016 / 2016 / 3608 / 2432 |
| 533 | 57 | 3752 | 69 / 56 / 59 / 57 / 57 | 3240 / 3372 / 3844 / 3924 / 3752 |
| 1065 | 62 | 4176 | 81 / 65 / 57 / 62 / 58 | 4176 / 4356 / 4212 / 2480 / 4172 |
| 1597 | 72 | 4624 | 81 / 66 / 89 / 72 / 65 | 4560 / 5000 / 4624 / 4636 / 3996 |
| 2528 | 76 | 5472 | 143 / 75 / 129 / 74 / 76 | 5280 / 5488 / 5472 / 5484 / 5472 |
| 4124 | 108 | 7132 | 123 / 97 / 109 / 94 / 108 | 7120 / 7140 / 7132 / 6700 / 7152 |
| 6119 | 154 | 8136 | 170 / 163 / 154 / 149 / 147 | 8172 / 8112 / 8148 / 8136 / 8112 |
| 8646 | 234 | 10120 | 254 / 234 / 217 / 228 / 236 | 10472 / 10092 / 10120 / 10624 / 10060 |
| 11173 | 344 | 12204 | 328 / 419 / 344 / 325 / 414 | 12204 / 12204 / 12208 / 11884 / 11836 |
| 14232 | 481 | 14336 | 562 / 490 / 477 / 481 / 458 | 14360 / 14336 / 14376 / 14316 / 14312 |
| 17690 | 715 | 16732 | 853 / 713 / 703 / 788 / 715 | 16808 / 16728 / 16732 / 16720 / 16764 |
| 21281 | 1061 | 19464 | 1002 / 1033 / 1170 / 1061 / 1064 | 19448 / 19440 / 19496 / 19468 / 19464 |
| 25271 | 1372 | 22340 | 1431 / 1330 / 1475 / 1369 / 1372 | 22344 / 22340 / 22392 / 22324 / 22332 |

## Ordinary Least Squares fits

Two cuts of the same data: the **normal-case** fit covers 2500 ≤ N ≤ 14000 — the band where the per-line variable cost dominates the fixed catalog-load floor (~50 ms), so the linear behaviour is visible without being masked by the constant baseline at very small N or by the trees-stage tag-construction deviation at very large N. The **full-range** fit includes every measurement point so the catalog-load floor and the high-N stress regime are both reported honestly.

| Metric | Range | Slope (per line) | Intercept | R² |
|---|---|---:|---:|---:|
| wall_ms vs N | normal case (2500 ≤ N ≤ 14000, n=5) | 0.030746 | -17.200 | **0.9773** |
| peak_kb vs N | normal case (2500 ≤ N ≤ 14000, n=5) | 0.753863 | 3699.119 | **0.9938** |
| wall_ms vs N | full range (200 ≤ N ≤ 25271, n=13) | 0.048928 | -62.428 | 0.9327 |
| peak_kb vs N | full range (200 ≤ N ≤ 25271, n=13) | 0.761472 | 3362.438 | 0.9961 |

## Interpretation

The thesis (Sections 3.4.1 and 3.4.2) claims both wall-time and peak memory grow linearly in the size of the submitted source. If both fits return R² ≥ 0.90 with a positive slope, the empirical evidence supports the linear claim within the range of N tested here.

- wall_ms R² = **0.9327** — supports the linear-time claim.
- peak_kb R² = **0.9961** — supports the linear-space claim.

Methodology notes: the synthesizer concatenates renamed copies of the base sample to reach the target line count, so the analyzer treats each copy as an independent translation unit. Wall time is `Process.ExitTime − Process.StartTime` on a direct `System.Diagnostics.Process` launch (not `Start-Process`, whose property bag is cleared on some PowerShell versions). Peak memory is sampled every 5 ms via `Process.Refresh()` + `WorkingSet64`, with `Process.PeakWorkingSet64` taken as a fallback maximum after exit. No warm-up runs are discarded — the first invocation is included in the median, since a cold start represents real first-use cost.

## Caveats

- This is a single-host measurement on the developer workstation, not the AWS Lightsail target. The slope is hardware-specific; the R² (linearity) is the portable signal.
- The synthesizer rewrites identifier names so each copy survives semantic analysis; a different choice of base sample would shift the slope but not change the linearity story.