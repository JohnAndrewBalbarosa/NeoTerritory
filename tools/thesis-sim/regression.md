# Empirical Regression — Wall Time and Peak Memory vs Input Size

_Generated 2026-05-15T13:00:33.600Z on win32 x64 (AMD Ryzen 5 2500U with Radeon Vega Mobile Gfx  , 7.6 GB RAM)._

Binary: `Codebase/Microservice/build-msys/Release/NeoTerritory.exe`
Synthesizer base sample: `Codebase/Microservice/samples/integration/all_patterns.cpp`
Repeats per N: **5** (median reported below).

## Median measurements per input size

| N (lines, actual) | wall_ms (median) | peak_kb (median) | wall samples | peak samples |
|---:|---:|---:|---|---|
| 134 | 54 | 2732 | 53 / 54 / 54 / 50 / 58 | 2708 / 3516 / 2028 / 2732 / 3452 |
| 533 | 56 | 3260 | 76 / 56 / 56 / 56 / 53 | 3260 / 3856 / 3848 / 3244 / 2892 |
| 1065 | 62 | 4160 | 83 / 63 / 62 / 60 / 59 | 4136 / 4484 / 4236 / 2032 / 4160 |
| 2129 | 73 | 5136 | 86 / 69 / 74 / 73 / 73 | 5184 / 5136 / 5104 / 5464 / 5020 |
| 5055 | 122 | 7596 | 135 / 120 / 126 / 120 / 122 | 8216 / 7444 / 7572 / 7596 / 8728 |
| 10109 | 309 | 10988 | 316 / 292 / 309 / 302 / 313 | 11032 / 11020 / 10980 / 10988 / 10980 |
| 20217 | 859 | 18632 | 923 / 851 / 835 / 859 / 924 | 18612 / 18632 / 18648 / 18620 / 18640 |

## Ordinary Least Squares fits

| Metric | Slope (per line) | Intercept | R² |
|---|---:|---:|---:|
| wall_ms vs N | 0.039572 | -2.557 | **0.9584** |
| peak_kb vs N | 0.773111 | 3166.512 | **0.9957** |

## Interpretation

The thesis (Sections 3.4.1 and 3.4.2) claims both wall-time and peak memory grow linearly in the size of the submitted source. If both fits return R² ≥ 0.90 with a positive slope, the empirical evidence supports the linear claim within the range of N tested here.

- wall_ms R² = **0.9584** — supports the linear-time claim.
- peak_kb R² = **0.9957** — supports the linear-space claim.

Methodology notes: the synthesizer concatenates renamed copies of the base sample to reach the target line count, so the analyzer treats each copy as an independent translation unit. Wall time is `Process.ExitTime − Process.StartTime` on a direct `System.Diagnostics.Process` launch (not `Start-Process`, whose property bag is cleared on some PowerShell versions). Peak memory is sampled every 5 ms via `Process.Refresh()` + `WorkingSet64`, with `Process.PeakWorkingSet64` taken as a fallback maximum after exit. No warm-up runs are discarded — the first invocation is included in the median, since a cold start represents real first-use cost.

## Caveats

- This is a single-host measurement on the developer workstation, not the AWS Lightsail target. The slope is hardware-specific; the R² (linearity) is the portable signal.
- The synthesizer rewrites identifier names so each copy survives semantic analysis; a different choice of base sample would shift the slope but not change the linearity story.