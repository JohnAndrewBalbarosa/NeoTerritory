---
title: "What is the Testing Trophy?"
authors: "Symflower (citing Kent C. Dodds)"
year: 2023
url: "https://symflower.com/en/company/blog/2023/what-is-the-testing-trophy/"
kind: article
priority: primary
---

## Summary

The Testing Trophy is a deliberate inversion of the unit-test pyramid. It allocates the most testing effort to integration tests, with E2E and unit tests on the smaller wings, and static analysis as a stable broad base. Kent C. Dodds proposed it in 2018; Symflower's 2023 write-up is the clearest recent restatement.

## Why it matters for this thesis

Per D44, NeoTerritory's testing strategy follows the Trophy, not the pyramid. The reasoning: the system is a multi-process pipeline (frontend ↔ backend ↔ C++ microservice ↔ external AI provider), so the bugs that hurt users live at the seams between processes — exactly where integration tests catch and unit tests do not.

## What we use from it

Layered budget; each layer is required to be non-empty before any release:

- **Static analysis (broad base):** TypeScript strict, ESLint, `clang-tidy`, `clang-format`, `cppcheck` if available.
- **Integration tests (the meat):** backend-route tests that spawn the real microservice binary against curated sample C++ files; pattern-catalog tests that load each catalog JSON and assert the matcher emits the expected signature on the catalog's own samples; AI-pipeline tests that stub the Claude HTTP client but exercise the real chunking / timeout / fallback logic per D37.
- **E2E (critical-flow):** Playwright runs covering "open studio → load sample → analyze → see pattern card → request docs → see fallback or AI doc." One spec per critical flow. Quarantine flaky specs immediately.
- **Unit tests (small, surgical):** only where the function has nontrivial branching that integration tests cannot cheaply cover (e.g., the candidate-filter ambiguity logic per D38, the heuristic class-usage binder per D24).

## Sprint R — Stress harness

AI-generated random-C++ test cases drive the analyzer through edge cases (nested templates, multi-inheritance, anonymous namespaces, lambdas, etc.). Output to `test-artifacts/stress/<run-date>/` with detection-rate, false-positive, false-negative, and crash counters. Failing seeds promote to the regression integration suite.

The "incremental testing using the algorithm's `usages` graph" idea is parked here: only revisited if random fuzzing + curated regressions do not catch enough.
