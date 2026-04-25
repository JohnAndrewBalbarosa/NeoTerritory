# Modules

- Folder: `docs/Codebase/Microservice/Modules`
- Role: top-level blueprint for source and header documentation structure

## Structure Rule
- outer folder = subsystem
- next folder = algorithm stage or functional module
- next folder = pattern family only when the logic truly branches by pattern
- file name = local implementation unit

## Active Shape
```text
Modules/
  Source/
    main.cpp.md
    Analysis/
    Trees/
    HashingMechanism/
    OutputGeneration/
  Header/
    SyntacticBrokenAST/
      Analysis/
      Trees/
      HashingMechanism/
      OutputGeneration/
```

## Naming Rule
- absorb repeated conceptual prefixes into folders
- shorten file names after the path already carries the shared meaning
- keep `Library/` only for truly shared cross-module logic

## Acceptance Checks
- source starts from a direct `main.cpp.md` entrypoint instead of a single-subsystem wrapper folder
- header still mirrors the same logic-first stage order inside its active wrapper
- tree logic, hashing logic, and output logic are visibly separate
- the source tree stage can describe rooted ownership and simultaneous actual plus virtual-broken generation without falling back to old sibling labels
- family-first pattern roots are gone from the active module tree
