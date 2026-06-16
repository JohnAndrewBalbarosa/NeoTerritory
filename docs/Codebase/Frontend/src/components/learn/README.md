# learn

- Folder: docs/Codebase/Frontend/src/components/learn
- Owner: Frontend

## Logic Summary
Learner-facing progress and assessment surfaces that sit around the learning path. This folder owns the student dashboard, the pre-test / post-test pages, the adaptive pre-test provider, mixed Bloom question rendering, the unlock explanation, and the summary cards that help a learner see where they are doing well and where they still need work.

## Ownership Boundary
This folder owns presentation, section ordering, route-level guidance, and pre-test page flow. Server freshness decisions and analytics aggregation stay behind the learning API contract, while learner pages may call the existing progress endpoint to persist completed and theory-passed module ids.

Fresh pre-test gating is server-backed:
- `LearningAssessmentPage` saves submitted pre-test answers through the learning assessments API.
- `PatternsLearnPage` reads saved assessment history before opening the learning path.
- Per-module pre-test outcomes separate modules already assigned to learning from modules exempted by full pre-test mastery.
- The local pre-test flag is only a convenience after a fresh saved attempt with recorded answers passes; it is not the source of truth after admin course edits.
- If the server reports no fresh passing pre-test, the learner is redirected to `/pre-test`.

## Subsystem Story
Read `StudentDashboard.tsx.md` first. That file explains the post-completion dashboard surface, the lock state for first-time learners, and the score-summary layout.

## Folder Flow
```mermaid
flowchart TD
    Start["Open learner surface"]
    N0["Load module bank"]
    N1["Read assessment history"]
    D0{"Fresh pre-test passed?"}
    N2["Open learning path"]
    N3["Redirect pre-test"]
    N4["Persist progress"]
    N5["Recheck gate"]
    End["Stay in learning loop"]
    Start --> N0 --> N1 --> D0
    D0 -->|yes| N2 --> End
    D0 -->|no| N3 --> N4 --> N5 --> End
```

## Documents By Logic
### Dashboard Surface
- `StudentDashboard.tsx.md` - post-unlock learner dashboard surface with a locked-first-entry state.

### Assessment Gate
- `LearningAssessmentPage.tsx.md` - renders pre-test, post-test, and practical assessment submission surfaces when mirrored.
- `BloomQuestionRenderer.tsx.md` - renders MCQ, identification, and Studio theoretical questions from one mixed bank.
- `AdaptiveAssessmentProvider.tsx.md` - tracks the adaptive Bloom level and active module set when mirrored.
- `../marketing/patterns/PatternsLearnPage.tsx.md` - owns the learning-path gate that consumes server-backed pre-test evidence.
- `../../logic/pretestModuleOutcomes.ts.md` - derives per-module mastered levels, failed modules, and pre-test exemptions.

## Reading Hint
- Treat this folder as the learner-side companion to the module flow. The dashboard should never appear as a dead end; it should either explain why it is locked, show the next clear action, or send the learner back to a fresh pre-test when the course version has changed.
