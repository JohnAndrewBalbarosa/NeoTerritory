# Patterns

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns`
- Role: shared pattern analysis boundary after lexical structure, tree state, and usage context already exist.

## Read Order
1. `Middleman/`
2. `Families/`
3. `Families/Behavioural/`
4. `Families/Creational/`

## Boundary
- `Middleman/` stays outside the family folder because it owns shared orchestration, contracts, dispatch, registry behavior, and migration planning.
- `Families/` groups pattern families that use the shared middleman boundary.
- `Families/Behavioural/` owns behavioural-specific detection, structure, scaffold, and symbol-test logic.
- `Families/Creational/` owns creational-specific detection, structure, scaffold, symbol-test, and transform logic.

## Placement Rule
- Put pattern families under `Families/` when they are specific categories of pattern logic.
- Keep cross-family orchestration outside `Families/`; it belongs in `Middleman/`.
- Do not place `Middleman/` inside `Families/` because it is the dispatcher and contract layer used by multiple families.
