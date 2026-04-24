# Runtime

- Folder: `docs/Codebase/Microservice/Runtime`
- Role: application runtime orchestration around the deeper module code

## Primary Entry
- Start at `../main.cpp.md`, then enter `Back system/`.

## Read Order
1. `../main.cpp.md`
2. `Back system/README.md`
3. `Back system/syntacticBrokenAST.cpp.md`

## Boundary
- `Runtime/` owns process-level orchestration: CLI validation, file discovery, pipeline execution, diagnostics, and output writing.
- `Modules/` owns reusable parser, analysis, tree, hashing, and output-generation internals.
- `main.cpp.md` stays at `Microservice/` root because it represents the executable entrypoint, not a runtime submodule.

## Acceptance Checks
- runtime orchestration is not mixed into `Modules/`
- the top-level executable entrypoint remains outside this folder
- the folder name describes runtime orchestration directly
