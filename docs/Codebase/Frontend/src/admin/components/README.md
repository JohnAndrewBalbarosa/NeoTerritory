# components (admin)

- Folder: docs/Codebase/Frontend/src/admin/components
- Owner: Frontend

## Logic Summary
Admin-side panels that power the shell-level navigation, feature-release prompt control, instructor analytics surfaces, and mobile-friendly operator layouts. Instructor learning content is model-backed and already tagged in JSON; the admin layer only turns modules on or off and reads the prepared question data.

## Subsystem Story
Read the component docs in this order:
1. `FeatureReleasePanel.tsx.md` - prompt textbox and explicit default-off toggle preview.
2. `InstructorDashboard.tsx.md` - the Instructor section shell and its nested navigation.
3. `LearningAnalytics.tsx.md` - the question heatmap and drilldown table.
4. `ComplexityTab.tsx.md` - the saved-run complexity graphs and export controls.

## Folder Flow
```mermaid
flowchart TD
    Start["Open admin components"]
    N0["Configure release prompt"]
    N1["Switch instructor section"]
    N2["Inspect heatmap"]
    N3["Drill into answers"]
    End["Leave component stack"]
    Start --> N0 --> N1 --> N2 --> N3 --> End
```

## Acceptance Checks

- Prompt-driven toggle control stays separate from instructor analytics.
- Instructor navigation stays separate from heatmap detail rendering.
- Heatmap drilldown remains readable after the sidebar redesign.
- Question tagging comes from the module JSON, not from a runtime tagging step in the Instructor UI.
- Complexity export controls stay inside the Complexity tab, below the charts, and export the saved-run dataset rather than a synthetic summary.
- Narrow viewports keep action rows, downloads, and tables legible instead of forcing sideways page scrolling.
