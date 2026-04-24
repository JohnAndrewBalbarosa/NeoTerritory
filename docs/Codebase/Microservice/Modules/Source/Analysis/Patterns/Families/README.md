# Families

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Families`
- Role: family-specific pattern analysis grouped under one readable boundary.

## Read Order
1. `Behavioural/`
2. `Creational/`

## Boundary
- This folder owns pattern-family logic only.
- Shared pattern dispatch, contracts, registry, hooks orchestration, and migration notes stay in `../Middleman/`.
- New pattern families should be added here only when their logic is family-specific and not part of the shared middleman layer.

## Current Families
- `Behavioural/`: behavioural family structure, scaffold, and symbol evidence.
- `Creational/`: creational family structure, scaffold, symbol evidence, and transform pipeline.
