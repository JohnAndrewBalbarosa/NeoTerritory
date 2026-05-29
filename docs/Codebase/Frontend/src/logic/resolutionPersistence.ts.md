# `logic/resolutionPersistence.ts`

## Purpose
Client-side persistence for the studio's per-class pattern resolutions
(`AnalysisRun.classResolvedPatterns`). The studio run is in-memory only (the
store persists nothing but `nt_token` / `nt_user`), so a page reload / Vite HMR
/ re-analysis previously dropped the learner's tag pick (e.g. "this
`ComputerBuilder` is a `Builder`"). That re-triggered the test runner's
ambiguity gate (`tabs/GdbRunnerTab.tsx` → `localAmbiguous`) every time. This
module remembers the resolution map keyed by a hash of the **submitted source**,
so re-analysing byte-identical code restores the pick and the runner stays
unblocked.

## Scope (deliberately narrow)
It ONLY stores and re-hydrates the map the tagging UI already produces. It does
**not** participate in pattern detection, scoring, ranking, or candidate
filtering — that logic is entirely backend/microservice and is untouched.
Editing the source changes the hash, so a stale pick is never applied to
different code.

## Flow
- The store's `setCurrentRun` (restore) calls `loadResolutions(sourceKeyOf(run))`
  and merges the saved map under the run's own values.
- The store's `patchCurrentRun` (save) calls `saveResolutions(...)` whenever
  `classResolvedPatterns` changes (resolve **and** unresolve, both routed through
  it from `components/analysis/SourceView.tsx`).
- `clearAuth` calls `clearResolutions()` on logout (hygiene); `resetSession`
  intentionally does not, so a pick survives re-analysis within a session.

## Key symbols
- `sourceKeyOf(run)` — stable identity for the submitted source. FNV-1a hash of
  the source basis (multi-file: each file's `name + ' ' + sourceText` joined;
  else `sourceText`), suffixed with `:<length>` to cut collisions.
- `loadResolutions(key)` — the saved `Record<string,string>` for a key (or `{}`).
- `saveResolutions(key, map)` — upsert under the single localStorage key
  `nt_class_resolutions`, LRU-capped to ~50 sources (oldest by `ts` evicted). An
  empty map clears any prior entry.
- `clearResolutions()` — remove all persisted resolutions.
- `ls()` (internal) — resolves `window.localStorage` lazily per call, so the
  module is SSR-safe and unit-testable with a stubbed `window`.

## Collaborators
- `store/appState.ts` — the only caller (save/restore/clear hooks).
- `types/api.ts` — `AnalysisRun` (source + `classResolvedPatterns` shape).
- Consumers of the restored map (read-only, unchanged): `GdbRunnerTab`
  ambiguity gate + run-tests filter, `logic/annotatedModel.ts` class coloring.

## Storage
- Key: `nt_class_resolutions` → `{ [sourceKey]: { map, ts } }`.
- Best-effort: every access is try/catch-wrapped and no-ops without a DOM or on
  quota errors — it never throws into the store.
