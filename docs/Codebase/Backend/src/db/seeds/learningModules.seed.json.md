# `learningModules.seed.json`

## Sole job

This seed file provides the initial learning-module catalog rows for the backend CMS. It is the persisted source of truth for module content when the public `/api/learning/modules` endpoint serves seed-backed rows.

## Taxonomy Note

- The seed carries explicit Bloom taxonomy fields on theoretical and practical questions.
- Each theoretical bank is canonicalized to six questions in this order: remembering, understanding, applying, analyzing, evaluating, creating.
- Theoretical questions may be MCQ, identification, or Studio code-check items.
- Creating-level Studio questions are reserved for analyzer-detectable pattern modules; foundations and non-detectable modules use non-Studio fallbacks.
- The frontend still normalizes the public module list before assessment generation, so older API-shaped rows without taxonomy remain safe.
- Regenerate this file through `npm run dump:learning-seed` in `Codebase/Backend` after frontend catalog taxonomy changes.

## Ownership Boundary

This file defines data only. It should not contain behavior, fallback logic, or assessment-path rules.

## Acceptance Checks

- The backend can load the seed as published module content.
- The learner page can normalize the returned rows without needing a schema change.
- Assessment generation still receives exact Bloom levels after normalization.
- The persisted seed documents the intended Bloom level for each stored question.
- Every stored module has exactly six theoretical questions.
- At least one non-MCQ question shape remains present in the seed-backed bank.
