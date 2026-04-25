# Contracts

- Folder: `docs/Codebase/Microservice/Modules/Header/OutputGeneration/Contracts`
- Role: output-side orchestration contracts for documentation tags, unit-test targets, and structured reports

## Start Here
- `algorithm_pipeline.hpp.md` for the main output orchestration contract
- `analysis_context.hpp.md` for the shared payload carried through output generation

## Boundary
- This folder defines output-facing contracts.
- It does not own render-specific declarations.

## Acceptance Checks

- Contracts name documentation targets directly.
- Contracts provide fields needed by backend AI documentation payloads.
- Contracts do not carry refactor-candidate terminology for the live documentation path.

