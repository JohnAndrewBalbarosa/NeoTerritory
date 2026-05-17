# Empirical Regression — Wall Time and Peak Memory vs Input Size

_Generated 2026-05-16T15:46:46.593Z on win32 x64 (AMD Ryzen 5 2500U with Radeon Vega Mobile Gfx  , 7.6 GB RAM)._

Binary: `Codebase/Microservice/build-msys/Release/NeoTerritory.exe`
Synthesizer base sample: `Codebase/Microservice/samples/integration/all_patterns.cpp`
Repeats per N: **10** (median reported below).

## Median measurements per input size

| N (lines, actual) | wall_ms (median) | peak_kb (median) | wall samples | peak samples |
|---:|---:|---:|---|---|
| 267 | 106 | 3610 | 102 / 65 / 93 / 71 / 110 / 149 / 183 / 93 / 117 / 180 | 3464 / 3896 / 3600 / 3624 / 3556 / 3880 / 3544 / 3624 / 2016 / 3620 |
| 533 | 79 | 3776 | 133 / 76 / 59 / 74 / 82 / 3586 / 62 / 63 / 105 / 88 | 3844 / 3768 / 3784 / 3740 / 3932 / 3912 / 2016 / 3932 / 3760 / 2016 |
| 799 | 70.5 | 3908 | 92 / 81 / 72 / 77 / 74 / 68 / 69 / 64 / 57 / 67 | 3244 / 3840 / 2008 / 3684 / 3968 / 4056 / 3900 / 3916 / 4072 / 4036 |
| 1065 | 75 | 4384 | 92 / 72 / 86 / 92 / 84 / 73 / 77 / 71 / 68 / 73 | 4472 / 4184 / 4356 / 4444 / 4440 / 2012 / 4444 / 4412 / 4188 / 2768 |
| 1464 | 85 | 4592 | 128 / 87 / 82 / 91 / 76 / 77 / 80 / 90 / 83 / 87 | 4632 / 4976 / 4536 / 4632 / 4508 / 4544 / 4632 / 4552 / 3560 / 4936 |
| 1863 | 88 | 4978 | 134 / 91 / 83 / 89 / 81 / 77 / 92 / 87 / 77 / 94 | 5132 / 5100 / 4768 / 4780 / 5100 / 4380 / 5100 / 4884 / 4608 / 5072 |
| 2262 | 101 | 5200 | 97 / 78 / 102 / 106 / 92 / 100 / 103 / 109 / 122 / 95 | 5200 / 3392 / 5148 / 5224 / 5216 / 5156 / 5460 / 5200 / 5160 / 5224 |
| 2794 | 108.5 | 5586 | 148 / 131 / 111 / 106 / 96 / 87 / 90 / 95 / 130 / 116 | 5568 / 5752 / 5800 / 5568 / 5788 / 5560 / 5604 / 5568 / 5228 / 5804 |
| 3326 | 128.5 | 6014 | 193 / 131 / 93 / 122 / 126 / 150 / 183 / 106 / 162 / 101 | 6848 / 6084 / 5944 / 5888 / 5936 / 6084 / 5944 / 6828 / 6936 / 5848 |
| 3858 | 129 | 6452 | 141 / 131 / 127 / 133 / 137 / 117 / 142 / 120 / 114 / 113 | 6992 / 6444 / 6468 / 6452 / 6436 / 6196 / 6452 / 6452 / 6460 / 6196 |
| 4656 | 158 | 7206 | 189 / 143 / 190 / 215 / 147 / 157 / 175 / 151 / 159 / 156 | 7172 / 7164 / 7196 / 7220 / 7184 / 7344 / 7220 / 7368 / 7172 / 7216 |
| 5454 | 199 | 7876 | 561 / 196 / 181 / 230 / 189 / 202 / 161 / 330 / 684 / 159 | 7784 / 7792 / 7960 / 8304 / 7616 / 8292 / 8096 / 7732 / 8296 / 7656 |
| 6252 | 175 | 9112 | 206 / 178 / 198 / 229 / 209 / 161 / 161 / 172 / 172 / 160 | 9156 / 8232 / 9156 / 9120 / 9104 / 9152 / 9124 / 8212 / 8236 / 9096 |
| 7316 | 226.5 | 9638 | 224 / 229 / 232 / 223 / 188 / 206 / 330 / 219 / 232 / 355 | 9632 / 9048 / 9660 / 9644 / 8956 / 9652 / 9644 / 9636 / 9640 / 9636 |
| 8380 | 257.5 | 9908 | 271 / 422 / 261 / 250 / 246 / 254 / 290 / 233 / 215 / 306 | 10516 / 9908 / 10528 / 9908 / 9884 / 9880 / 9896 / 9848 / 10668 / 10516 |
| 9577 | 433 | 10644 | 362 / 499 / 287 / 371 / 450 / 509 / 416 / 1146 / 585 / 339 | 10644 / 10644 / 10700 / 10636 / 10628 / 10644 / 10608 / 10624 / 10652 / 10664 |
| 11173 | 473.5 | 12198 | 445 / 423 / 795 / 405 / 404 / 613 / 392 / 831 / 690 / 502 | 12200 / 12212 / 12208 / 12196 / 11792 / 11880 / 11852 / 11816 / 12208 / 12200 |
| 12636 | 626.5 | 13002 | 520 / 630 / 562 / 625 / 1185 / 554 / 515 / 633 / 628 / 1135 | 13000 / 13008 / 12944 / 13072 / 12932 / 13012 / 12992 / 13004 / 13004 / 12972 |
| 14232 | 1279 | 14318 | 682 / 893 / 1798 / 1516 / 1543 / 1471 / 1671 / 643 / 833 / 1087 | 14292 / 14428 / 14316 / 14328 / 14284 / 14328 / 14364 / 14320 / 14304 / 14192 |
| 15961 | 852.5 | 15414 | 1300 / 2320 / 765 / 901 / 859 / 1011 / 733 / 621 / 846 / 650 | 15352 / 15612 / 15432 / 15932 / 15616 / 15324 / 15396 / 15372 / 15552 / 15388 |
| 17956 | 777.5 | 16916 | 926 / 798 / 746 / 757 / 1004 / 841 / 735 / 953 / 726 / 696 | 16908 / 16924 / 16908 / 16936 / 16864 / 16932 / 16960 / 16900 / 16928 / 16908 |
| 20217 | 960 | 18630 | 1175 / 953 / 916 / 913 / 990 / 967 / 987 / 906 / 869 / 1686 | 18644 / 18624 / 18540 / 18644 / 18628 / 18632 / 18616 / 18664 / 18632 / 18604 |
| 22744 | 1411.5 | 20402 | 1433 / 1467 / 1822 / 1390 / 1237 / 1347 / 1247 / 1984 / 2118 / 1247 | 20408 / 20400 / 20404 / 20364 / 20340 / 20396 / 20360 / 20428 / 20452 / 20476 |
| 25271 | 2521.5 | 22364 | 1732 / 2368 / 2451 / 1592 / 2678 / 3205 / 3187 / 1946 / 3212 / 2592 | 22268 / 22284 / 22364 / 22320 / 22376 / 22316 / 22432 / 22380 / 22364 / 22364 |

## Ordinary Least Squares fits

Two cuts of the same data: the **normal-case** fit covers 2500 ≤ N ≤ 14000 — the band where the per-line variable cost dominates the fixed catalog-load floor (~50 ms), so the linear behaviour is visible without being masked by the constant baseline at very small N or by the trees-stage tag-construction deviation at very large N. The **full-range** fit includes every measurement point so the catalog-load floor and the high-N stress regime are both reported honestly.

| Metric | Range | Slope (per line) | Intercept | R² |
|---|---|---:|---:|---:|
| wall_ms vs N | normal case (2500 ≤ N ≤ 14000, n=11) | 0.049720 | -75.908 | **0.9147** |
| peak_kb vs N | normal case (2500 ≤ N ≤ 14000, n=11) | 0.752467 | 3716.673 | **0.9850** |
| wall_ms vs N | full range (200 ≤ N ≤ 25271, n=24) | 0.070530 | -116.182 | 0.8156 |
| peak_kb vs N | full range (200 ≤ N ≤ 25271, n=24) | 0.745626 | 3623.374 | 0.9980 |

## Interpretation

The thesis (Sections 3.4.1 and 3.4.2) claims both wall-time and peak memory grow linearly in the size of the submitted source. If both fits return R² ≥ 0.90 with a positive slope, the empirical evidence supports the linear claim within the range of N tested here.

- wall_ms R² = **0.8156** — does NOT support the linear-time claim.
- peak_kb R² = **0.9980** — supports the linear-space claim.

Methodology notes: the synthesizer concatenates renamed copies of the base sample to reach the target line count, so the analyzer treats each copy as an independent translation unit. Wall time is `Process.ExitTime − Process.StartTime` on a direct `System.Diagnostics.Process` launch (not `Start-Process`, whose property bag is cleared on some PowerShell versions). Peak memory is sampled every 5 ms via `Process.Refresh()` + `WorkingSet64`, with `Process.PeakWorkingSet64` taken as a fallback maximum after exit. No warm-up runs are discarded — the first invocation is included in the median, since a cold start represents real first-use cost.

## Caveats

- This is a single-host measurement on the developer workstation, not the AWS Lightsail target. The slope is hardware-specific; the R² (linearity) is the portable signal.
- The synthesizer rewrites identifier names so each copy survives semantic analysis; a different choice of base sample would shift the slope but not change the linearity story.