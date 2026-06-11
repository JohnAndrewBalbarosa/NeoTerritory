# `CoursePlanPanel.tsx`

## Sole job

Provide the admin course-planning prompt surface. This panel lets the operator type a project brief, preview the inferred course plan, inspect the required-learning and module board summaries, and then apply the selected module toggles. The pattern audit itself is delegated to `CoursePlanPatternAudit.tsx`.

## Layout Goal

The panel should read like an operator tool, not a marketing card:

- prompt textbox at the top
- preview summary and verification strip beneath it
- pattern audit visible inside the preview through a dedicated child component
- required modules and AI-enabled board split into separate sections
- apply action separate from the preview

## Flow

```mermaid
flowchart TD
    Start["Open course planner"]
    N0["Enter brief"]
    N1["Preview plan"]
    N2["Read verification"]
    N3["Inspect audit"]
    N4["Review AI board"]
    N5["Review required modules"]
    D0{"Apply plan?"}
    N6["Leave modules off"]
    N7["Patch module states"]
    N8["Refresh preview"]
    End["Leave planner"]
    Start --> N0 --> N1 --> N2 --> N3 --> N4 --> N5 --> D0
    D0 -->|no| N6 --> End
    D0 -->|yes| N7 --> N8 --> End
```

## Preview Contract

- The preview shows whether the plan came from AI or the heuristic fallback.
- The verification strip summarizes the current diagnostic state as `Verified`, `Fallback used`, or `Verification failed`.
- The diagnostics surface selection counts, fallback reason, validation hints, and pattern diversity when present.
- The pattern audit lists the strongest candidates, their scores, whether they were selected, and a short rejection reason when they were not.
- The audit block lives in `CoursePlanPatternAudit.tsx` so the parent panel can stay focused on prompt handling and plan application.
- Required modules render below the audit, and the AI-enabled board only shows non-foundation modules that the plan turns on.
- Stable `data-testid` hooks expose the verification strip, AI-enabled board, required modules section, and required badges for Playwright.
- The preview stays visible until the operator clears the prompt or applies the plan.

## Acceptance Checks

- A blank prompt does not generate a preview.
- The diagnostics distinguish AI success from heuristic fallback.
- The pattern audit is visible in the admin preview through the dedicated child component, not hidden in a console-only log.
- The apply action only touches the modules that changed in the preview.
- Narrow viewports keep the prompt, audit, and module board readable without sideways scrolling.
