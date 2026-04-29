/**
 * Re-export barrel for the canonical types directory.
 *
 * Every other module imports from `@/types` (or `../../types` until paths are
 * configured). The frontend's mirror at `Codebase/Frontend/src/types/` re-exports
 * the same shapes — keep them in sync.
 */

export * from './api';
export * from './analysis';
export * from './auth';
export * from './catalog';
export * from './seat';
