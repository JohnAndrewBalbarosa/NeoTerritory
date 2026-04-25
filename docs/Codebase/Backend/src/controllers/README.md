# controllers

- Folder: docs/Codebase/Backend/src/controllers
- Descendant source docs: 2
- Generated on: 2026-04-23

## Logic Summary
Controller layer for concrete backend request handling after routing and middleware have finished preliminary work. The transform controller now owns the live class-analysis HTTP boundary while services own the analysis and AI documentation work.

## Subsystem Story
This folder is mostly leaf-level. The local documents here carry the main explanation of the subsystem without requiring much extra descent.

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Study Controllers docs"]
    End["Folder Exit"]
    Start --> N0
    N0 --> End
```

## Documents By Logic
### Controllers
These documents explain the local implementation by covering Implements HTTP endpoint behavior after routing and before response serialization.
- authController.js.md : Implements HTTP endpoint behavior after routing and before response serialization.
- transformController.js.md : Handles live class-analysis requests, delegates analysis, requests AI documentation, and returns diagnostics or targets.

## Reading Hint
- This folder is mostly leaf-level. Read the local file docs to understand the logic in this area.

