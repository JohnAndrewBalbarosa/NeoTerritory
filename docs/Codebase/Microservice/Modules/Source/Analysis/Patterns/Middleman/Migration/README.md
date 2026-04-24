# Migration

## Purpose
These migration notes explain how the pattern docs are organized around one shared middleman layer and one grouped family layer.

## Current Split
```text
Patterns/
  Middleman/
  Families/
    Behavioural/
    Creational/
```

## Ownership
- `Middleman/` owns cross-family orchestration, contracts, registry, context, dispatch, assembly, and hook adapters.
- `Families/Behavioural/` owns behavioural-specific implementation logic.
- `Families/Creational/` owns creational-specific implementation logic.

## Migration Sequence
1. Keep shared middleman docs outside `Families/`.
2. Keep Behavioural and Creational under `Families/`.
3. Update links that previously pointed at top-level family folders.
4. Keep future family folders under `Families/` unless they are shared orchestration logic.

## Acceptance Checks
- There are no top-level family folders under `Patterns/`.
- `Patterns/Middleman/` remains a sibling of `Patterns/Families/`.
- Family docs link through `Families/` when referring to Behavioural or Creational.
