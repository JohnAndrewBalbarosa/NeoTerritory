# Migration

## Purpose
These migration notes explain how the pattern docs are organized around one catalog layer, one shared middleman layer, and one grouped family layer.

## Current Split
```text
Patterns/
  Catalog/
  Middleman/
  Families/
    Behavioural/
    Creational/
```

## Ownership
- `Catalog/` owns data-driven pattern definitions and parsing.
- `Middleman/` owns cross-family orchestration, contracts, registry, context, dispatch, assembly, and hook adapters.
- `Families/Behavioural/` owns behavioural-specific implementation logic.
- `Families/Creational/` owns creational-specific implementation logic.

## Migration Sequence
1. Add `Catalog/` as the first read for automated pattern definitions.
2. Keep shared middleman docs outside `Families/`.
3. Keep Behavioural and Creational under `Families/`.
4. Update links that previously pointed at top-level family folders.
5. Keep future family folders under `Families/` unless they are shared orchestration logic.

## Acceptance Checks
- There are no top-level family folders under `Patterns/`.
- `Patterns/Catalog/` exists as a sibling of `Patterns/Middleman/`.
- `Patterns/Middleman/` remains a sibling of `Patterns/Families/`.
- Family docs link through `Families/` when referring to Behavioural or Creational.
