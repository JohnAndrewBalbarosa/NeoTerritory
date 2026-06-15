# learning.ts

- Source: `Backend/src/routes/learning.ts`
- Kind: Express router

## Story

### What Happens Here

This router owns the learner-facing learning API. It serves the public module bank, persists signed-in learner progress, records per-question exam answers, records assessment attempts, and returns saved assessment history with the current course freshness timestamp.

The route treats SQLite as the source of truth. Supabase mirrors are best-effort copies for durability and reporting; they do not decide whether a learner can enter the course.

### Why It Matters In The Flow

The learning path relies on this router to make pre-test gating durable across refreshes and devices. The frontend can keep a local pre-test flag for immediate UI continuity, but the route-level assessment history and `courseUpdatedAt` value decide whether a saved passing pre-test is still fresh after admin course edits.

Per-module Bloom mastery also lives in the learner progress snapshot. The value is a JSON map of `moduleId -> 0..6`, where `0` means no saved mastery and `6` means the module can be exempted for that learner.

## Learner Module Flow

```mermaid
flowchart TD
    Start["Request modules"]
    N0["Read learning_modules"]
    N1["Filter published"]
    N2["Keep foundations"]
    N3["Parse JSON columns"]
    End["Return module DTOs"]
    Start --> N0 --> N1 --> N2 --> N3 --> End
```

## Assessment History Flow

```mermaid
flowchart TD
    Start["Signed-in learner"]
    N0["Read attempts"]
    N1["Read answers"]
    N2["Read course_updated_at"]
    N3["Return history"]
    End["Frontend evaluates gate"]
    Start --> N0 --> N1 --> N2 --> N3 --> End
```

## Assessment Write Flow

```mermaid
flowchart TD
    Start["Submit assessment"]
    N0["Validate type"]
    N1["Sanitize answers"]
    N2["Insert attempt"]
    N3["Insert answers"]
    N4["Mirror best effort"]
    End["Return attempt id"]
    Start --> N0 --> N1 --> N2 --> N3 --> N4 --> End
```

## Progress Write Flow

```mermaid
flowchart TD
    Start["Save progress"]
    N0["Sanitize ids"]
    N1["Clamp Bloom map"]
    N2["Upsert row"]
    N3["Mirror best effort"]
    End["Return snapshot"]
    Start --> N0 --> N1 --> N2 --> N3 --> End
```

## Route Contracts

- `GET /api/learning/modules` is public and returns published modules plus foundation modules, ordered by `sort_order`.
- `GET /api/learning/progress` requires auth and returns completed module ids, last unlocked module id, theoretical-pass module ids, and `bloomMasteryByModule`.
- `PUT /api/learning/progress` requires auth and upserts sanitized progress for the user and optional session; `bloomMasteryByModule` values are clamped to `0..6`.
- `PUT /api/learning/answers` requires auth and records module theoretical exam answers plus an append-only exam attempt row.
- `GET /api/learning/assessments` requires auth and returns `attempts`, `answers`, and `courseUpdatedAt`.
- `PUT /api/learning/assessments` requires auth and records pre-test, post-test, post-test-2, or practical assessment answers as an append-only attempt.

## Fresh Pre-Test Semantics

- `courseUpdatedAt` is read from the `course_updated_at` app setting.
- The frontend ignores pre-test attempts created before `courseUpdatedAt`.
- The backend does not delete old attempts when an admin changes the course; old rows remain historical evidence but are no longer gate-valid.
- A fresh pre-test means the learner has an assessment attempt with recorded answers created after the latest admin course reset trigger.

## Reset Triggers

The reset timestamp is written by the admin router, not this learner router. These learner-visible changes make previous pre-tests stale:
- admin module create
- admin module full update
- admin module publish / auto-tag / sort-order patch
- admin module delete
- applied AI course plan, because it patches changed module publish states

Preview-only AI course plans do not call this router, do not mutate modules, and do not change `course_updated_at`.

## Acceptance Checks

- Public module reads stay non-cacheable so learner content reflects admin changes promptly.
- Assessment history includes `courseUpdatedAt` alongside attempts and answers.
- Assessment writes are append-only and preserve old attempts for analytics.
- Progress reads and writes preserve the per-user, per-module Bloom mastery map.
- Freshness is enforced by comparing attempt creation time to `courseUpdatedAt` and requiring recorded answer rows, not by deleting learner data.
- Preview-only AI course plan generation cannot reset learners.
