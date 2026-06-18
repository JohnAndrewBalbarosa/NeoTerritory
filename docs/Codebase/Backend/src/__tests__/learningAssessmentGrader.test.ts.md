# `learningAssessmentGrader.test.ts`

## Sole job

Pin authoritative Learner Path scoring against an in-memory canonical question bank.

## Coverage

```mermaid
flowchart TD
    Start["Create six Bloom questions"]
    A["Submit all correct"]
    B["Submit all wrong"]
    C["Submit mixed answers"]
    D["Submit unanswered"]
    E["Omit one question"]
    End["Assert secure scores"]
    Start --> A --> End
    Start --> B --> End
    Start --> C --> End
    Start --> D --> End
    Start --> E --> End
```

- Perfect answers produce 100%.
- Wrong answers produce 0%.
- Mixed answers cannot produce a perfect score.
- Unanswered items remain in the denominator.
- Incomplete final attempts are rejected.
