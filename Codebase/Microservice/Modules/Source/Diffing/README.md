# Diffing

- Folder: `docs/Codebase/Microservice/Modules/Source/Diffing`
- Role: interval auto-checking, affected-subtree detection, virtual-to-actual comparison, and partial regeneration planning

## Start Here
Read `core.cpp.md` first. It explains how interval checks re-run lexical structural analysis, locate the affected subtree, compare virtual and actual equivalents, and return a scoped regeneration plan.

## Active Tree
```text
Diffing/
  core.cpp.md
  AffectedNodeLocator/
    core.cpp.md
  SubtreeComparison/
    core.cpp.md
  PatternOwnership/
    core.cpp.md
  RegenerationPlan/
    core.cpp.md
```

## Ownership Boundary
`Diffing/` does not own parsing, hashing, or output rendering. It coordinates those subsystems when an interval check reports changed source.

## Handoffs
- Calls `Analysis/` to re-run lexical structural analysis for the changed region.
- Calls `Trees/` to locate and regenerate affected actual or virtual subtrees.
- Calls `HashingMechanism/` to refresh scoped hashes after subtree regeneration.
- Sends a regeneration report to `OutputGeneration/`.

## Shared Logic Decision
For now, this subsystem should directly call `Analysis`, `Trees`, and `HashingMechanism` entrypoints instead of introducing a global shared folder. If repeated helpers grow later, keep them local under `Diffing/Common/` or the owning subsystem.

