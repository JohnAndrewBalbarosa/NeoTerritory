# `BloomQuestionRenderer.tsx`

## Sole job

Render one Bloom-tagged theoretical question in the learner UI. It chooses the correct control surface for MCQ, identification, or Studio code-check questions and reports the learner answer through a single callback shape.

## Render Flow

```mermaid
flowchart TD
    Start["Receive question"]
    D0{"Question type"}
    N0["Render MCQ"]
    N1["Render tokens"]
    N2["Render Studio"]
    End["Report answer"]
    Start --> D0
    D0 -->|mcq| N0 --> End
    D0 -->|identification| N1 --> End
    D0 -->|studio| N2 --> End
```

## Studio Boundary

Studio questions pass `targetPatternSlug` and optional `starterCode` into `StudioSurface`. Detection success is reported as the learner answer; the renderer does not run pattern analysis itself.

## Acceptance Checks

- MCQ, identification, and Studio questions render from the same theoretical bank.
- Studio creating questions can preload starter code into the embedded analysis form.
- Result display follows the answer state passed by the parent assessment surface.
