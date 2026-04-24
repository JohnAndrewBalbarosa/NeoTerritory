# Middleman

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Middleman`
- Role: shared orchestration layer for pattern analysis.

## Read Order
1. `Contracts/`
2. `Registry/`
3. `Context/`
4. `Dispatcher/`
5. `Assembler/`
6. `Middleman/`
7. `Hooks/`
8. `Migration/`

## Boundary
- This folder owns shared pattern contracts, registry, context, dispatch, assembly, middleman orchestration, and migration notes.
- It intentionally stays outside `../Families/` because it coordinates multiple pattern families.
- Family-specific implementation logic belongs in `../Families/Behavioural/` or `../Families/Creational/`.

## Placement Rule
- Put cross-family orchestration here.
- Put behavioural and creational algorithm implementations under `../Families/`.
- Keep hook adapters here only when they connect family-specific logic into the shared middleman pipeline.

## Acceptance Checks
- `Middleman/` remains a sibling of `Families/`, not a child of it.
- Shared pattern flow can be understood before reading any family-specific implementation.
- Family-specific docs do not duplicate registry, dispatch, or contract ownership.
