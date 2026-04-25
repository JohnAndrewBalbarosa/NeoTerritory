# src

- Folder: docs/Codebase/Backend/src
- Descendant source docs: 14
- Generated on: 2026-04-23

## Logic Summary
Backend internals grouped by request flow. Routing directs requests into middleware, then controllers, with database, service, and utility helpers supporting live class analysis, AI documentation, and structured logs.

## Subsystem Story
This folder mainly acts as a navigation layer. Use it to understand how the deeper child folders divide the subsystem into smaller concerns.

## Folder Flow

### Block 1 - Folder Flow Details
#### Slice 1 - Continue Local Flow
```mermaid
flowchart TD
    N0["Folder Entry"]
    N1["Open Services folders"]
    N2["More local items?"]
    N3["Open Controllers folders"]
    N4["More local items?"]
    N5["Open Middleware folders"]
    N6["More local items?"]
    N7["Open Routes folders"]
    N8["More local items?"]
    N9["Open Data layer folders"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Slice 2 - Continue Local Flow
```mermaid
flowchart TD
    N0["More local items?"]
    N1["Open Utilities folders"]
    N2["More local items?"]
    N3["Folder Exit"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```

## Child Folders By Logic
### Services
These child folders continue the subsystem by covering reusable backend support for class analysis, AI documentation, and structured logging.
- services/ : Reusable backend support services for analysis, AI documentation, and logs.

### Controllers
These child folders continue the subsystem by covering controller behavior for concrete backend request handling after routing and middleware have finished preliminary work.
- controllers/ : Controller layer for live class analysis and related request handling.

### Middleware
These child folders continue the subsystem by covering Cross-cutting backend request logic such as auth, upload handling, and error shaping.
- middleware/ : Cross-cutting backend request logic such as auth, upload handling, and error shaping.

### Routes
These child folders continue the subsystem by covering route behavior that maps URL paths to middleware chains and controller entrypoints.
- routes/ : Route layer for live class-analysis JSON requests and existing backend routes.

### Data Layer
These child folders continue the subsystem by covering SQLite-oriented persistence helpers and schema initialization logic.
- db/ : SQLite-oriented persistence helpers and schema initialization logic.

### Utilities
These child folders continue the subsystem by covering Small backend utilities used to keep the request handlers concise.
- utils/ : Small backend utilities used to keep the request handlers concise.

## Reading Hint
- Use the child folder groups to navigate deeper into this subsystem.
