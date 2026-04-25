# pages

- Folder: docs/Codebase/Frontend/pages
- Descendant source docs: 6
- Generated on: 2026-04-23

## Logic Summary
Route-sized HTML fragments for the user-facing microservice workflow.

## Subsystem Story
This folder is mostly leaf-level. The local documents explain the screens a user moves through while submitting input, waiting for backend orchestration, inspecting microservice artifacts, reviewing fixes, and downloading output.

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Study Pages docs"]
    End["Folder Exit"]
    Start --> N0
    N0 --> End
```

## Documents By Logic
### Pages
These documents explain the route fragments that the client-side router injects into the main content area.
- dashboard.html.md : Shows job summaries and entry points into the microservice workflow.
- analysis-new.html.md : Captures source input and starts a backend transform job.
- results.html.md : Summarizes completed microservice output and links to artifacts.
- diff-viewer.html.md : Displays source, diff, parse-tree, and report artifacts.
- fix-suggestions.html.md : Displays returned fix candidates and validation checks.
- download.html.md : Exposes generated output artifacts for download.

## Reading Hint
- Read these pages in workflow order: dashboard, analysis-new, results, diff-viewer, fix-suggestions, download.

