# TODO — Multi-file submission with per-file tabs

Deferred from the round on `2026-05-XX`. The user asked for the studio to
accept multiple `.cpp` / `.h` files in one analysis run, with per-file tabs
inside *Submit* and *Annotated Source*, an "Add file" button, and a "Delete
file" affordance that hides itself when only one file remains. The
microservice already accepts multiple input paths — this is an end-to-end
plumbing change in the gateway and the React state model.

## Why deferred

The current `AnalysisRun` shape carries a single `sourceText` and a single
`sourceName`. `SourceView`, `AnnotatedTab`, `synthesizeUsageAnnotations`,
`classResolvedPatterns`, `linePatternOverrides`, the run-history table, and
the save/load endpoints all assume one source per run. Splitting that
across N files touches every render path that reads `currentRun.sourceText`.

This is a real architecture change, not a small UI tweak. It needs its own
round so it doesn't interleave with smaller fixes.

## Sketch

### Frontend

- `Codebase/Frontend/src/components/analysis/AnalysisForm.tsx` becomes a
  list of `FileSlot` rows. Each slot has its own filename + sourceText +
  file picker. `+ Add file` button appends a slot. `× Delete` button is
  hidden when `slots.length === 1`.
- New type `AnalysisRunFile { name; sourceText; annotations; classUsageBindings; }`.
- `AnalysisRun` gains `files: AnalysisRunFile[]`. `sourceText` and
  `sourceName` become aliases for `files[0]` so old call sites keep working
  during the migration.
- `AnnotatedTab` and `SourceView` get a sub-tab strip at the top, one per
  file. Switching tabs swaps the active `AnalysisRunFile` into the existing
  rendering pipeline; no other component needs to know there are multiple.
- `classResolvedPatterns` stays a single `Record<className, patternKey>`
  shared across files — class names are unique within a run by convention
  (the microservice resolves cross-file references).
- `PatternCards` continues to render across all files; each card already
  shows its `className`, no per-file disambiguation needed.

### Backend

- `Codebase/Backend/src/routes/analysis.ts` — switch `multer.single('file')`
  to `multer.array('files', 16)` (cap at 16 files for the request budget).
  Accept JSON body with `files: Array<{ name, code }>` for the paste path.
- Forward all file paths as positional argv to the microservice (its CLI
  already loops `input_paths`, per the existing `cli_arguments.cpp:5-39`).
- The microservice returns one merged result; preserve per-file boundaries
  in the response by tagging each annotation with `fileName` (falling back
  to the run's primary file when the source file is unknown).
- Save endpoint (`POST /api/runs/save`) stores the full `files[]` array
  inside the existing `analysis_json` blob — no new column.

### Microservice

- Already supports multiple input paths. Verify it tags each annotation
  with the source file path so the frontend can route them. If not, add a
  `--source-file <id>` per-file flag and emit the id in each annotation
  record.

## Acceptance

- Submit two files (`Singleton.cpp` + `Builder.cpp`); analysis returns one
  run with two file tabs in Annotated Source. Each tab paints its own
  source with annotations and class-pattern colours.
- Retag a class in `Singleton.cpp`; only that file's lines re-colour;
  `Builder.cpp` is untouched.
- Save the run, reload — both file tabs and tag state are restored.
- Delete-file button is absent when only one slot exists; appears as soon
  as the second slot is added.

## Files likely to change

| Layer | File |
|---|---|
| FE form | `Codebase/Frontend/src/components/analysis/AnalysisForm.tsx` |
| FE types | `Codebase/Frontend/src/types/api.ts` |
| FE source view tabs | `Codebase/Frontend/src/components/tabs/AnnotatedTab.tsx`, `Codebase/Frontend/src/components/analysis/SourceView.tsx` |
| FE submit tab | `Codebase/Frontend/src/components/tabs/SubmitTab.tsx` |
| BE analyze | `Codebase/Backend/src/routes/analysis.ts` |
| BE save/load | same file (`/runs/save`, `/runs/:id`) |
| Microservice | `Codebase/Microservice/cli_arguments.cpp` (verify per-file tagging) |

## Existing utilities to reuse

- `multer.array` is already a peer dep — no new dep.
- The microservice's `input_paths` loop in `cli_arguments.cpp:5-39` is the
  natural multi-input surface; just feed more.
- `classUsageBindings` is already a `Record<className, ClassUsageBinding[]>`
  so cross-file class references survive intact.
