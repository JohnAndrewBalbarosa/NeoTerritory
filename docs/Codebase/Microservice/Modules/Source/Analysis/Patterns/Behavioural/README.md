# Behavioural

- Folder: `docs/Codebase/Microservice/Modules/Source/Behavioural`
- Descendant source docs: 4
- Generated on: 2026-04-23

## Current Contents
```text
Behavioural/
  Logic/
  behavioural_broken_tree.cpp.md
  behavioural_symbol_test.cpp.md
```

## Structure Problem
This folder is family-first. The function boundary is hidden inside the file names:
- `behavioural_broken_tree.cpp.md`
- `behavioural_symbol_test.cpp.md`

The `Logic/` folder also mixes scaffold and hook support under a generic name instead of a concrete function folder.

## Target Placement
```text
Pattern/
  BrokenTree/
    Behavioural/
      tree.cpp.md
  SymbolTest/
    Behavioural/
      symbol_test.cpp.md
  Hooks/
    Behavioural/
      scaffold.cpp.md
      structure.cpp.md
```

## Naming Rule
- Put `Behavioural` below the function folder, not above it.
- Let `BrokenTree/` and `SymbolTest/` explain the role.
- Shorten filenames once the path already carries the common meaning.
- Replace generic `Logic/` ownership with a concrete hook folder.

## Migration Checks
- No behavioural source file stays at the outer subsystem root.
- `Behavioural` becomes a subfolder under a real function folder.
- `behavioural_` is removed from filenames once the path already says `Behavioural`.
