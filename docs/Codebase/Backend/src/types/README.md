# Backend Shared Types

`Codebase/Backend/src/types/` is the canonical type spine. Every TS file in the backend imports from here so that route handlers, services, middleware, and (eventually) the frontend mirror at `Codebase/Frontend/src/types/` all agree on wire shapes.

## Files

- `api.ts` — generic envelope (`ApiResponse<T>`), `HealthResponse`.
- `analysis.ts` — `AnalysisReport`, `DetectedPattern`, `PatternRanking`, `Annotation` (with `scope: 'file' | 'line'` discriminator from Bucket F).
- `auth.ts` — `JwtPayload`, `Role`, `AuthedRequest = Request & { user: JwtPayload }`.
- `catalog.ts` — `PatternCatalog`, `PatternEntry`, `OrderedCheck`, `EvidenceRule` (D29 vocabulary), `EvidenceSignals`.
- `seat.ts` — Devcon seat-key session types. Encodes the invariant that `privateKey` is required ONLY on `SeatClaimResponse` and absent on every other shape.
- `index.ts` — barrel re-export.

## Invariants encoded in types

- `SeatClaimResponse.privateKey: string` is required; no other response shape has a `privateKey` field. A handler that accidentally serializes one is a compile error.
- `Annotation.scope: 'line' | 'file'` — file-scoped annotations skip per-line rendering on the frontend (criterion: no fake "no pattern found" line markers).
- `EvidenceRule.kind` is a closed string-literal union — adding a new evidence kind requires updating both the catalog parser and the ranker, with the compiler enforcing the change everywhere.
- `PatternEntry.language` is `'cpp' | 'java' | 'python' | 'go' | 'typescript'` — multi-language analyzer dispatch (D29) is type-checked from day one.

## Cross-language pairing

The frontend mirror at `Codebase/Frontend/src/types/` re-exports the same shapes (file contents duplicated, not symlinked, because TS doesn't follow symlinks reliably across drives on Windows). A small CI script diffs the two trees to keep them aligned. When a backend type changes, the matching frontend file changes in the same commit.
