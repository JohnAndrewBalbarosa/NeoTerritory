# src

- Folder: docs/Codebase/Backend/src
- Descendant source docs: 12
- Generated on: 2026-04-23

## Logic Summary
Backend internals grouped by request flow. Routing directs requests into middleware, then controllers, with database, service, and utility helpers supporting the work.

## Child Folders By Logic
### Controllers
- controllers/ : Controller layer for concrete backend request handling after routing and middleware have finished preliminary work.

### Data Layer
- db/ : SQLite-oriented persistence helpers and schema initialization logic.

### Middleware
- middleware/ : Cross-cutting backend request logic such as auth, upload handling, and error shaping.

### Routes
- routes/ : Route layer that maps URL paths to middleware chains and controller entrypoints.

### Services
- services/ : Reusable backend support services called from controllers or middleware.

### Utilities
- utils/ : Small backend utilities used to keep the request handlers concise.

## Reading Hint
- Use the child folder groups to navigate deeper into this subsystem.

