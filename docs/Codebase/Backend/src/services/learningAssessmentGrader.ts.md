# `learningAssessmentGrader.ts`

## Sole job

Authoritatively grade Learner Path assessments against the canonical questions stored in `learning_modules`. The service ignores client-supplied taxonomy and correctness, rejects duplicate or unknown question references, and treats unanswered values as incorrect.

## Grading flow

```mermaid
flowchart TD
    Start["Receive answers"]
    N0["Reject duplicates"]
    N1["Load canonical module"]
    N2["Resolve question index"]
    N3["Compare submitted value"]
    N4["Count correct answers"]
    End["Return server grade"]
    Start --> N0 --> N1 --> N2 --> N3 --> N4 --> End
```

## Complete-attempt guard

```mermaid
flowchart TD
    Start["Persist attempt"]
    N0["Read published modules"]
    N1["Build expected Bloom keys"]
    N2["Compare submitted keys"]
    N3{"Exact coverage?"}
    N3 -->|Yes| Save["Allow persistence"]
    N3 -->|No| Reject["Reject attempt"]
```

## Rules

- MCQ answers compare `selectedIndex` with the stored `correctIndex`.
- Identification answers compare normalized tokens with stored `expectedTokens`.
- Studio completion uses the submitted analyzer-success response.
- `selectedIndex = -1` with no response is an unanswered, incorrect item.
- Final pre-tests must contain every published module and all six Bloom buckets.
- The client never supplies an authoritative score or `isCorrect` value.

## Acceptance checks

- All-correct answers produce 100%.
- All-wrong answers produce 0%.
- Mixed answers produce a non-perfect proportional score.
- Unanswered items remain in the denominator and score as incorrect.
- Missing or duplicated question references cannot inflate a saved score.
