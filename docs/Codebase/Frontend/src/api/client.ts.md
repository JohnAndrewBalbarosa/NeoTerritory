# client.ts

- Source: `Frontend/src/api/client.ts`
- Kind: frontend API client

## Story
This client carries typed frontend calls for learner progress, formal assessments, module content, admin settings, and analyzer/test-runner requests. For learning progress, it reads and writes the same durable fields the learner path depends on: completed modules, last unlocked module, practical tries, theoretical passes, Bloom mastery, and skipped optional modules.

## Read Order
1. `LearningProgress` for the learner progress transport shape.
2. `fetchLearningProgress()` and `saveLearningProgress()` for durable learner state.
3. `saveLearningAssessment()` for formal pre-test, post-test, and practical attempt writes.
4. `apiFetch()` for shared request behavior.

## Boundary
- The client does not interpret Bloom mastery; it only transports the already-derived `bloomMasteryByModule` map.
- The client preserves `triesByModule` on readback so progress updates can merge new mastery without dropping practical attempt counts.
- Assessment scoring remains in `learningAssessments.ts`; this file only posts sanitized payloads to the backend.

## Acceptance Checks
- `fetchLearningProgress()` exposes `triesByModule` and `bloomMasteryByModule`.
- `saveLearningProgress()` can send completed ids, last unlocked id, tries, theory passes, Bloom mastery, and skipped ids together.
- `saveLearningAssessment()` remains the single formal-assessment write helper for the learner assessment page.
