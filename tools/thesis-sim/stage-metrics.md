# Microservice Stage Metrics — Real Per-Stage Timing

_Generated 2026-05-15T16:07:32.250Z. Binary: `Codebase/Microservice/build-msys/Release/NeoTerritory.exe`. Repeats per sample: **7** (median reported)._

This is the authoritative per-stage timing the thesis worst-case analysis should cite: it isolates the C++ analyzer (lexical → trees → pattern_dispatch → hashing) from network RTT, Express middleware, AI commentary, and JSON serialization in the HTTP path. The numbers come from the microservice's own `report.json` `stage_metrics` array.

## Median per-sample stage timings

| Sample | Lines | Tokens | analysis (ms) | trees (ms) | pattern_dispatch (ms) | hashing (ms) | total (ms) | detected | doc tgt | ut tgt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `negative/plain_class_no_pattern.cpp` | 16 | 44 | 18 | 0 | 0 | 0 | **18** | 9 | 1 | 4 |
| `wrapping/logging_proxy.cpp` | 32 | 90 | 16 | 0 | 0 | 0 | **16** | 22 | 2 | 4 |
| `singleton/config_registry.cpp` | 34 | 84 | 17 | 0 | 0 | 0 | **17** | 10 | 1 | 6 |
| `factory/shape_factory.cpp` | 40 | 103 | 11 | 0 | 0 | 0 | **11** | 40 | 4 | 7 |
| `method_chaining/query_predicate.cpp` | 34 | 72 | 11 | 0 | 0 | 0 | **11** | 11 | 1 | 3 |
| `pimpl/pimpl_basic.cpp` | 37 | 75 | 12 | 0 | 0 | 0 | **12** | 19 | 1 | 4 |
| `builder/http_request_builder.cpp` | 51 | 105 | 12 | 0 | 0 | 0 | **12** | 20 | 2 | 4 |
| `strategy/strategy_basic.cpp` | 47 | 132 | 12 | 0 | 1 | 0 | **13** | 43 | 4 | 7 |
| `usages/usages_basic.cpp` | 35 | 156 | 10 | 0 | 0 | 0 | **10** | 9 | 1 | 6 |
| `mixed/mixed_classes.cpp` | 27 | 86 | 10 | 0 | 0 | 0 | **10** | 19 | 2 | 8 |
| `integration/all_patterns.cpp` | 132 | 339 | 10 | 0 | 1 | 0 | **11** | 103 | 10 | 22 |

## OLS regression on total_ms vs input size

| Predictor | Slope | Intercept | R² |
|---|---:|---:|---:|
| total_ms vs lines  | -0.0305 ms/line | 14.16 | **0.1069** |
| total_ms vs tokens | -0.0138 ms/tok | 14.43 | **0.1480** |

## Per-stage regression vs lines

| Stage | Slope (ms/line) | Intercept (ms) | R² |
|---|---:|---:|---:|
| analysis | -0.0402 | 14.41 | 0.1750 |
| trees | 0.0000 | 0.00 | 1.0000 |
| pattern_dispatch | 0.0097 | -0.25 | 0.5382 |
| hashing | 0.0000 | 0.00 | 1.0000 |

## Items-processed per stage (proxy for retained-objects space)

| Sample | analysis | trees | pattern_dispatch | hashing |
|---|---:|---:|---:|---:|
| `negative/plain_class_no_pattern.cpp` | 0 | 0 | 9 | 9 |
| `wrapping/logging_proxy.cpp` | 0 | 0 | 22 | 22 |
| `singleton/config_registry.cpp` | 0 | 0 | 10 | 10 |
| `factory/shape_factory.cpp` | 0 | 0 | 40 | 40 |
| `method_chaining/query_predicate.cpp` | 0 | 0 | 11 | 11 |
| `pimpl/pimpl_basic.cpp` | 0 | 0 | 19 | 19 |
| `builder/http_request_builder.cpp` | 0 | 0 | 20 | 20 |
| `strategy/strategy_basic.cpp` | 0 | 0 | 43 | 43 |
| `usages/usages_basic.cpp` | 0 | 0 | 9 | 9 |
| `mixed/mixed_classes.cpp` | 0 | 0 | 19 | 19 |
| `integration/all_patterns.cpp` | 0 | 0 | 103 | 103 |

## Synthetic-size sweep — stage timing scales with input

The fixed-sample table above is dominated by the ~10 ms catalog-load floor of the `analysis` stage, so the millisecond timer cannot resolve per-stage scaling at those sizes. The sweep below concatenates renamed copies of `integration/all_patterns.cpp` to reach progressively larger N (lines) so each stage spends measurable time and the slope becomes visible.

| N (lines) | analysis (ms) | trees (ms) | pattern_dispatch (ms) | hashing (ms) | total (ms) | detected patterns |
|---:|---:|---:|---:|---:|---:|---:|
| 533 | 11 | 2 | 4 | 0 | **17** | 412 |
| 1065 | 11 | 6 | 7 | 0 | **24** | 824 |
| 2129 | 12 | 16 | 15 | 0 | **43** | 1648 |
| 5055 | 14 | 72 | 36 | 0 | **122** | 3914 |
| 10109 | 16 | 232 | 55 | 0 | **303** | 7828 |
| 20217 | 22 | 824 | 118 | 0 | **964** | 15656 |

OLS fits on the synthetic sweep:

| Predictor (synthetic N=500/1000/2000/5000/10000/20000) | Slope (ms/line) | Intercept (ms) | R² |
|---|---:|---:|---:|
| **total_ms vs N** | 0.0476 | -64.94 | **0.9633** |
| analysis_ms vs N | 0.0006 | 10.71 | 0.9950 |
| trees_ms vs N | 0.0414 | -77.79 | 0.9526 |
| pattern_dispatch_ms vs N | 0.0057 | 2.14 | 0.9945 |
| hashing_ms vs N | 0.0000 | 0.00 | 1.0000 |
| detected_patterns vs N | 0.7744 | -0.77 | 1.0000 |

## Methodology notes

- Numbers are pulled from `report.json` written by `run_output_stage` (see `Codebase/Microservice/Modules/Source/OutputGeneration/Render/codebase_output_writer.cpp:101` which serialises each `StageMetric` as `{stage_name, milliseconds, items_processed}`).
- The microservice does NOT yet self-report peak memory; "items_processed" per stage is the closest proxy for retained-objects space and is included above for completeness.
- The HTTP/end-to-end timings in `tools/thesis-sim/regression.md` (synthetic local sweep up to N=20,000 lines) and the AWS soak latencies are complementary: this report measures the algorithm itself, the other two measure the user-observable time including network and platform overhead.