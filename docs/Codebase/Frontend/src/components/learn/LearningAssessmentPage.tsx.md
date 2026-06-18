# LearningAssessmentPage.tsx

- Source: `Frontend/src/components/learn/LearningAssessmentPage.tsx`
- Kind: learner assessment route

## Story
This component renders the pre-test, post-test, and post-test-2 pages. It owns the current answer map, delegates question rendering to `BloomQuestionRenderer`, requests an authoritative backend grade, and advances the adaptive Bloom pre-test by removing modules that fail the current level.

## Flow

```mermaid
flowchart TD
    A[Load modules] --> B[Build questions]
    B --> C[Filter current level]
    C --> D[Collect answers]
    D --> E[Request server grade]
    E --> F[Eliminate failures]
    F --> G[Continue or finish]
```

## Boundary
- The backend grade response is the source of truth for mastery, failure, and recommendation changes.
- Module elimination still runs through `eliminateModules()` from `AdaptiveAssessmentProvider`.
- The page does not own the question-bank shape; that stays in `learningAssessments.ts` and `learningModules.ts`.
- The page does not create any hidden answer bypass. Local testing still goes through the same visible assessment controls the learner uses.

## Acceptance Checks
- Wrong modules are removed from the active module pool after a pre-test level is submitted.
- Unanswered questions can be submitted and are returned as incorrect by the backend.
- A client cannot mark its own answers correct or send a trusted score.
- The assessment UI stays readable when multiple questions are present.
- The current wrapper flow stays independent per question because the page only submits the rendered answer set.
