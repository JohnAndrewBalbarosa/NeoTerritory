# learn

- Folder: docs/Codebase/Frontend/src/components/learn
- Owner: Frontend

## Logic Summary
Learner-facing progress surfaces that sit after the first module unlock. This folder owns the student dashboard, the unlock explanation, the progress summary cards, and the weak/strong area views that help a learner see where they are doing well and where they still need work.

## Ownership Boundary
This folder owns presentation, section ordering, and route-level guidance only. It must not own scoring rules, completion persistence, unlock writes, or analytics aggregation. Those belong to the learning backend and the progress API contract.

## Subsystem Story
Read `StudentDashboard.tsx.md` first. That file explains the post-completion dashboard surface, the lock state for first-time learners, and the score-summary layout.

## Folder Flow
```mermaid
flowchart TD
    Start["Open learner surface"]
    N0["Check module progress"]
    D0{"First module complete?"}
    N1["Show locked explainer"]
    N2["Show dashboard summary"]
    N3["Highlight strengths"]
    N4["Highlight gaps"]
    N5["Suggest next module"]
    End["Stay in learning loop"]
    Start --> N0 --> D0
    D0 -->|no| N1 --> End
    D0 -->|yes| N2 --> N3 --> N4 --> N5 --> End
```

## Documents By Logic
### Dashboard Surface
- `StudentDashboard.tsx.md` - post-unlock learner dashboard surface with a locked-first-entry state.

## Reading Hint
- Treat this folder as the learner-side companion to the module flow. The dashboard should never appear as a dead end; it should either explain why it is locked or show the next clear action.

