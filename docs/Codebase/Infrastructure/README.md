# Infrastructure

- Folder: docs/Codebase/Infrastructure
- Descendant source docs: 7
- Generated on: 2026-04-23

## Logic Summary
Infrastructure automation and runtime environment assembly for local containerized execution.

## Subsystem Story
This folder mainly acts as a navigation layer. Use it to understand how the deeper child folders divide the subsystem into smaller concerns.

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Open Session orchestration folders"]
    L0{"More items?"}
    N1["Open Runtime layout folders"]
    L1{"More items?"}
    End["Folder Exit"]
    Start --> N0
    N0 --> L0
    L0 -->|more| N0
    L0 -->|done| N1
    N1 --> L1
    L1 -->|more| N1
    L1 -->|done| End
```

## Child Folders By Logic
### Continuous Integration
These child folders continue the subsystem by covering developer-only and CI-only verification contracts, including Step 1 -> Step 2 orchestration checks and production no-leak assertions.
- ContinuousIntegration/ : GitHub Actions workflow blueprint for developer diagnostics and production isolation checks.

### Session Orchestration
These child folders continue the subsystem by covering Session bootstrap logic that prepares Docker, Minikube, runtime images, templates, and runtime folders.
- session-orchestration/ : Session bootstrap logic that prepares Docker, Minikube, runtime images, templates, and runtime folders.

### Runtime Layout
These child folders continue the subsystem by covering Scripts that create the filesystem layout expected by the executable runtime.
- runtime-layout/ : Scripts that create the filesystem layout expected by the executable runtime.

## Reading Hint
- Use the child folder groups to navigate deeper into this subsystem.

