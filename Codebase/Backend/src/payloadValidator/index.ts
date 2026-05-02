// NeoTerritory backend payload validator — single entry point.
//
// Folder layout:
//
//   payloadValidator/
//     index.ts              ← this file (re-exports every domain's schemas)
//     analyze/index.ts      ← /api/analyze body
//     runs/index.ts         ← /api/runs/save and /api/runs/submit-and-save
//     auth/index.ts         ← /auth/login, /auth/claim
//     survey/index.ts       ← /api/survey/* and /api/reviews/*
//     gdb/index.ts          ← /api/analysis/run-tests body (incl. stdin)
//     common/index.ts       ← reusable primitives (filenameSchema, etc.)
//
// All routes import their schemas from here, NOT from the legacy
// `validation/schemas.ts` shim (which now just re-exports from this
// folder for backwards compatibility while existing routes migrate).
//
// The same Zod shapes are mirrored on the frontend in
// `Codebase/Frontend/src/lib/payloadSchemas.ts` so submissions are
// pre-validated client-side before they hit the wire — the backend
// remains the source of truth and re-validates on every request.

export * from './common';
export * from './analyze';
export * from './runs';
export * from './auth';
export * from './survey';
export * from './gdb';
