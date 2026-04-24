# Creational

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Families/Creational`
- Role: creational-family pattern analysis after the shared `Patterns/Middleman/` boundary.

## Read Order
1. `Scaffold/core.cpp.md`
2. `Structure/core.cpp.md`
3. `Builder/core.cpp.md`
4. `Factory/core.cpp.md`
5. `Singleton/core.cpp.md`
6. `SymbolTest/core.cpp.md`
7. `Transform/`

## Boundary
- This folder owns creational-specific detection, structure verification, generated evidence, and transform behavior.
- Shared dispatch, registry, hook contracts, and orchestration stay in `../../Middleman/`.
- Behavioural-specific logic belongs in `../Behavioural/`.

## Placement Rule
- Keep Builder, Factory, Singleton, and creational transform docs under this family folder.
- Put reusable cross-family helpers in `../../Middleman/` or a shared analysis utility instead of duplicating them here.
