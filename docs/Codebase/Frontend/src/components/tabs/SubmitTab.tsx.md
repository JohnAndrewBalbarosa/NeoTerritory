# `SubmitTab.tsx`

## Sole job

Host the Studio submit form and recent run list for the Submit tab. It passes analysis callbacks down to `AnalysisForm` and keeps run-list refresh behavior tied to Studio-level state.

## Submit Flow

```mermaid
flowchart TD
    Start["Open Submit tab"]
    N0["Render AnalysisForm"]
    N1["Pass starter file"]
    N2["Submit analysis"]
    N3["Refresh runs"]
    End["Stay on tab"]
    Start --> N0 --> N1 --> N2 --> N3 --> End
```

## Acceptance Checks

- `initialFile` is forwarded unchanged to `AnalysisForm`.
- `beforeAnalyze` still wraps the dispatch callback.
- Run-list refresh remains controlled by the parent Studio surface.
