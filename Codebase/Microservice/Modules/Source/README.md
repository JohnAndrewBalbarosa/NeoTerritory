# Source

- Folder: `docs/Codebase/Microservice/Modules/Source`
- Role: source-side navigation map for the flattened analysis subsystem

## Primary Entry
- Start with [main.cpp.md](../../../../docs/Codebase/Microservice/Modules/Source/main.cpp.md).

## Active Tree
```text
Source/
  main.cpp.md
  Analysis/
    Input/
    Lexical/
    ImplementationUse/
    Patterns/
  Trees/
    MainTree/
    ClassGeneration/
      Actual/
      VirtualBroken/
      Attachment/
    Shared/
  HashingMechanism/
    ReverseMerkle/
    HashLinks/
  Diffing/
    AffectedNodeLocator/
    SubtreeComparison/
    PatternOwnership/
    RegenerationPlan/
  OutputGeneration/
    UnitTestGeneration/
    DocumentationTagger/
    Report/
    Render/
```

## Read By Goal
- Whole subsystem: `main.cpp.md`
- Structural and pattern analysis: `Analysis/`
- Rooted tree ownership and class generation: `Trees/`
- Cascading identity and lookup: `HashingMechanism/`
- Interval auto-checking and partial subtree regeneration: `Diffing/`
- Unit-test generation, tagging, reports, and render output: `OutputGeneration/`

## Boundary
- `README.md` is for folder navigation.
- `main.cpp.md` is the real subsystem start file.
- Stage folders own their local entrypoints and helper guides.

## Acceptance Checks
- a reader can start from `main.cpp.md` without opening a wrapper folder first
- `README.md` guides navigation instead of duplicating the subsystem intro
- stage folders remain the main ownership boundaries
