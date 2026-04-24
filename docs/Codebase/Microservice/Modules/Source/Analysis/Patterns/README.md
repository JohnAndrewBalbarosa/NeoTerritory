# Patterns

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns`
- Role: design-pattern interpretation after structure, tree, and usage context already exist

## Read Order
1. `Middleman/`
2. `Behavioural/`
3. `Creational/`

## Boundary
- `Middleman/` owns shared orchestration, contracts, dispatch, and registry behavior.
- `Behavioural/` and `Creational/` own family-specific logic only after the shared pattern boundary is established.


