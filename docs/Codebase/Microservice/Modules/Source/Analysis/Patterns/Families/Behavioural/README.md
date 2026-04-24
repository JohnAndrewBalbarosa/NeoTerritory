# Behavioural

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Families/Behavioural`
- Role: behavioural-family pattern analysis after the shared `Patterns/Middleman/` boundary.

## Read Order
1. `Scaffold/core.cpp.md`
2. `Structure/core.cpp.md`
3. `SymbolTest/core.cpp.md`

## Boundary
- This folder owns behavioural-specific checks, scaffolding, and symbol-test output.
- Shared dispatch, registry, hook contracts, and orchestration stay in `../../Middleman/`.
- Creational-specific logic belongs in `../Creational/`.

## Placement Rule
- Keep behavioural implementation docs here only when their behavior depends on behavioural pattern semantics.
- Put reusable cross-family helpers in `../../Middleman/` or a shared analysis utility instead of duplicating them here.
