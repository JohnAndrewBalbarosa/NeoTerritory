# NeoTerritory

## Overview

For research purposes

Repository: [JohnAndrewBalbarosa/NeoTerritory](https://github.com/JohnAndrewBalbarosa/NeoTerritory)

## Problem and Goal

**Problem.** Students learning software design patterns need source-anchored feedback rather than generic AI explanations detached from actual code structure.

**Goal.** Analyze C++ projects for design-pattern evidence and generate labelled, educational documentation backed by deterministic structural analysis.

## System Design

- `Codebase/Microservice/`: C++ analysis service built with CMake.
- `Codebase/Backend/` + `Codebase/FastifyService/`: TypeScript APIs and auxiliary service.
- `Codebase/Frontend/` + `FrontendNext/`: React/Vite and Next.js learning interfaces.
- `docs/`, `ops/`, and scripts: architecture, evaluation, deployment, and operational tooling.

## Setup and Usage

```bash
npm install
npm run setup
npm run dev

# Validate web packages
npm run build
```

## Evaluation Method

- Validated the analyzer against a 50-participant study.
- Scored 150 analysis runs across 10 design-pattern categories against participant intent labels.
- Measured detection quality with precision, recall, F1, compile pass rate, static-analysis pass rate, unit-test pass rate, and internal reliability.

## Results

- Overall F1: 0.870.
- Overall precision: 0.900.
- Overall recall: 0.842.
- Validation scale: 50 participants and 150 runs.
- Time complexity: O(n), with R^2 = 0.9998 and about 9.6 microseconds per token slope.
- Compile pass rate: 90.0% (135/150).
- Static-analysis pass rate: 88.0% (132/150).
- Unit-test pass rate: 84.2% (235/279).
- Internal reliability: Cronbach alpha 0.93-0.96 across five subscales.

## Interpretation

- The analyzer has strong evidence as a deterministic source-anchored design-pattern detector for the validated pattern set.
- The O(n) slope suggests the detection approach scales linearly with source size; fixed host overhead should be interpreted separately from algorithmic cost.
- The current open gap is a direct baseline comparison against simpler regex or heuristic detectors on the same corpus.

## Limitations

- Results should only be treated as validated when this README includes the dataset, sample size, metric definition, and reproduction steps.
- Any AI-generated, OCR-based, scraped, or heuristic output requires manual review before being used as ground truth.
- Environment-dependent measurements such as latency, memory use, browser behavior, and API reliability should be re-measured on the target machine.

## Recommendations and Future Work

- Run and publish a baseline detector comparison using the same participant corpus.
- Expand the validation set beyond class-level C++ examples.
- Track per-pattern regressions in CI before changing detection rules.

## Documentation Standard

This README follows a technical-project structure: overview, goal, system design, setup, evaluation method, results, interpretation, limitations, and recommendations. Update the Results section whenever new measurements are available so project claims stay evidence-backed.
