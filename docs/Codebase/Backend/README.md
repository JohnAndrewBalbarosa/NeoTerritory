# Backend

- Folder: docs/Codebase/Backend
- Descendant source docs: 14
- Generated on: 2026-04-22

## Logic Summary
Backend service surface. This area groups the Express entrypoint, package metadata, and the HTTP runtime internals under src.

## Child Folders By Logic
### Backend Internals
- src/ : Backend internals grouped by request flow. Routing directs requests into middleware, then controllers, with database, service, and utility helpers supporting the work.

## Documents By Logic
### Runtime Configuration
- package.json.md : Declares backend scripts and runtime dependencies.

### Runtime Entrypoints
- server.js.md : Bootstraps the Express backend, middleware stack, routes, database initialization, and filesystem layout.

## Reading Hint
- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.

