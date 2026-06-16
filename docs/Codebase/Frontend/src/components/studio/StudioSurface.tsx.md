# `StudioSurface.tsx`

## Sole job

Render the interactive Studio workspace and coordinate analyzer output, tabs, tours, and embedded target-pattern checks. It is the shared surface used by the standalone Studio and learner Studio questions.

## Embedded Check Flow

```mermaid
flowchart TD
    Start["Open Studio"]
    N0["Render submit tab"]
    N1["Seed starter code"]
    N2["Run analysis"]
    D0{"Target detected?"}
    N3["Notify question"]
    End["Keep workspace open"]
    Start --> N0 --> N1 --> N2 --> D0
    D0 -->|yes| N3 --> End
    D0 -->|no| End
```

## Learning Boundary

The surface accepts `targetPatternSlug`, optional target copy, an optional `starterCode`, and an `onPatternDetected` callback. It does not grade Bloom levels or decide module completion.

## Acceptance Checks

- Starter code reaches the submit form for embedded Studio questions.
- Pattern detection callbacks fire when the target slug appears in analyzer results.
- Standalone Studio remains usable without target-pattern or starter-code props.
