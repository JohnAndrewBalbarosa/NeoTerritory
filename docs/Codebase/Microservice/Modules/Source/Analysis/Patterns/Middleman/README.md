# Middleman

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Middleman`
- Role: shared orchestration layer for catalog-driven pattern analysis.

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
- It consumes normalized catalog definitions from `../Catalog/`.
- It intentionally stays outside `../Families/` because it coordinates multiple pattern families.
- Family-specific implementation logic belongs in `../Families/Behavioural/` or `../Families/Creational/`.
- Shared types like `PatternTemplateNode`, `PatternScaffold`, and `PatternStructureChecker` stay here in `Contracts/`, not inside a family folder.

## Placement Rule
- Put cross-family orchestration here.
- Put behavioural and creational algorithm implementations under `../Families/`.
- Keep hook adapters here only when they connect family-specific logic into the shared middleman pipeline.
- Keep catalog parsing in `../Catalog/`; the middleman should receive definitions that are already validated.

## Acceptance Checks
- `Middleman/` remains a sibling of `Families/`, not a child of it.
- Shared pattern flow can be understood before reading any family-specific implementation.
- Family-specific docs do not duplicate registry, dispatch, or contract ownership.
- The middleman can run every enabled catalog pattern without source-pattern user input.
