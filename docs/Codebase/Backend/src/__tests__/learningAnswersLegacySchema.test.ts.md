# `learningAnswersLegacySchema.test.ts`

## Sole job

Protect conceptual-assessment persistence on databases created before `session_id` joined the question-result key.

```mermaid
flowchart TD
    Start["Create legacy table"]
    N1["Submit first answer"]
    N2["Submit retry"]
    N3["Read stored row"]
    End["Preserve first try"]
    Start --> N1 --> N2 --> N3 --> End
```

## Acceptance checks

- The route does not raise an `ON CONFLICT` constraint error.
- A retry updates the selected answer and correctness.
- Attempt count increments.
- First-attempt correctness remains unchanged.
