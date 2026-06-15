# `learningAssessments.ts`

## Sole job

This module builds the pre-test, post-test, and post-test-2 question sets, grades those answers locally, and derives the foundation bypass evidence used by the learner gate. Per-module mastery/exemption is owned by `pretestModuleOutcomes.ts` so this file stays focused on assessment question shape and raw-answer interpretation.

## Program Flow

```mermaid
flowchart TD
    Start["Receive modules"]
    Norm["Normalize taxonomy"]
    Plan["Walk Bloom levels"]
    Match["Pick module question"]
    Emit["Return assessment set"]
    Grade["Score answers"]

    Start --> Norm --> Plan --> Match --> Emit --> Grade
```

## Server-Backed Freshness Flow

Saved attempts are only trusted when they include recorded answers and are newer than the course version returned by the backend.

```mermaid
flowchart TD
    Start["Receive assessments"]
    N0["Read courseUpdatedAt"]
    N1["Filter pretests"]
    N2["Ignore stale attempts"]
    N3["Pick latest fresh attempt"]
    N4["Score foundation evidence"]
    End["Return gate result"]
    Start --> N0 --> N1 --> N2 --> N3 --> N4 --> End
```

## Assessment Selection Rule

- The pre-test walks each Bloom taxonomy and includes one matching question for every module that has that taxonomy available.
- Post-test surfaces reuse the same exact-taxonomy selection path so stored answers retain module and taxonomy metadata.
- Missing taxonomy buckets are skipped for that module rather than filled with a wrong-taxonomy fallback.
- The builder normalizes API-shaped modules before selection, so a missing taxonomy field in seed-loaded data does not break the assessment contract.

## Foundation Gate

The foundation pretest still passes only when the learner demonstrates the bypass taxonomies the gate cares about:
- remembering
- understanding
- applying

There are two evaluation paths:
- `evaluateFoundationPretest(...)` grades the current in-browser submission before it is saved.
- `evaluateFoundationPretestFromAssessments(...)` reads persisted attempts and ignores any pre-test whose `createdAt` is older than `courseUpdatedAt`.
- `derivePretestModuleOutcomes(...)` in the logic folder consumes the same saved attempts to derive per-module mastered Bloom levels, failed modules, and fully exempt modules.

The backend stores raw selections, free-text responses, question metadata, and the global `course_updated_at` setting. This module performs the client-side interpretation of that saved evidence.

## Reset Semantics

- A `courseUpdatedAt` value means an admin changed the learner-visible course contract.
- Pre-test attempts created before that timestamp, or attempts without recorded answers, are stale and cannot unlock the path.
- The comparison is attempt-level: an older passing pre-test is ignored even if the learner still has a local `preTestCompleted` flag.
- A missing fresh attempt returns failed evidence with the foundation bypass taxonomies marked as missing.
- Preview-only AI course plans do not appear here because they do not mutate course rows and do not bump `course_updated_at`.

## Acceptance Checks

- Pre-test, post-test, and post-test-2 questions keep exact Bloom taxonomy labels.
- No wrong-taxonomy fallback is used during question selection.
- Modules missing a taxonomy bucket are skipped for that bucket without hiding later buckets.
- Foundation personas remain distinguishable by mastered and missing taxonomies.
- Saved pre-test evidence older than `courseUpdatedAt` fails the gate.
- A saved fresh passing pre-test can unlock the path without relying on local-only state.
