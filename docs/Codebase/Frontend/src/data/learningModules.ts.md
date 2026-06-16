# `learningModules.ts`

## Sole job

This module defines the canonical learning catalog shape and builds the runtime `LEARNING_MODULES` list. It owns Bloom taxonomy tagging for theory questions, mixed-question normalization for API-shaped modules, and the default taxonomy for practical prompts.

## Read Order

Read the file from top to bottom:
1. Type definitions for the learning catalog.
2. Bloom taxonomy inference and normalization helpers.
3. Static module authoring blocks.
4. `attachExams(...)`, which turns authored module content into the runtime catalog.

## Program Flow

```mermaid
flowchart TD
    Start["Load module source"]
    Infer["Infer or keep taxonomy"]
    Tag["Build six Bloom slots"]
    Pack["Attach exams"]
    Catalog["Expose runtime catalog"]

    Start --> Infer --> Tag --> Pack --> Catalog
```

## Taxonomy Contract

- Static authored questions may omit `taxonomy`; the file infers it from the question text, scenario, prompt, explanation, or code snippet.
- `normalizeLearningModule(...)` and `normalizeLearningModules(...)` restore missing taxonomy and expose exactly one theory question for each of the six Bloom levels.
- Sparse authored theory banks receive generated fallback questions so the learner-side default module bank still has six Bloom-level questions.
- MCQ questions are normalized with an explicit `type: "mcq"` so legacy rows match the mixed-bank contract.
- Creating-level questions use Studio only when the module can be detected by the analyzer; foundations and non-detectable modules receive identification fallbacks.
- Practical exams receive a default taxonomy when the source module does not declare one.

## Ownership Boundary

This file owns local catalog shaping only. It does not fetch remote modules, grade answers, or decide which question a learner sees on a specific assessment screen.

## Acceptance Checks

- Every runtime module question has a taxonomy after normalization.
- Each runtime module with a theory bank exposes all six Bloom levels after normalization.
- Mixed MCQ, identification, and Studio questions keep their type-specific fields after normalization.
- API-loaded modules with missing taxonomy still normalize to the same browser contract as the static catalog.
