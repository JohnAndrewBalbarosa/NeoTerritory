# routes

- Folder: docs/Codebase/Backend/src/routes
- Descendant source docs: 3
- Generated on: 2026-04-23

## Logic Summary
Route layer that maps URL paths to middleware chains and controller entrypoints. The live class-analysis route is a JSON endpoint separate from legacy file upload.

## Subsystem Story
This folder is mostly leaf-level. The local documents here carry the main explanation of the subsystem without requiring much extra descent.

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Study Routes docs"]
    L0{"More items?"}
    End["Folder Exit"]
    Start --> N0
    N0 --> L0
    L0 -->|more| N0
    L0 -->|done| End
```

## Documents By Logic
### Routes
These documents explain the local implementation by covering Maps HTTP routes to middleware and controllers.
- auth.js.md : Maps HTTP routes to middleware and controllers.
- health.js.md : Maps HTTP routes to middleware and controllers.
- transform.js.md : Maps the live class-analysis JSON endpoint and the legacy upload endpoint to their controller paths.

## Reading Hint
- This folder is mostly leaf-level. Read the local file docs to understand the logic in this area.

