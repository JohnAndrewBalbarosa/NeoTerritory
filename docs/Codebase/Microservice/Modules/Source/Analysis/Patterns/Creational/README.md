# Creational

- Folder: `docs/Codebase/Microservice/Modules/Source/Creational`
- Descendant source docs: 25
- Generated on: 2026-04-23

## Current Contents
```text
Creational/
  Builder/
  Factory/
  Logic/
  Singleton/
  Transform/
  creational_broken_tree/
  creational_broken_tree.cpp.md
  creational_symbol_test.cpp.md
```

## Structure Problem
This folder mixes several different grouping rules:
- family folders: `Builder/`, `Factory/`, `Singleton/`
- function folders: `Transform/`
- implementation-name folders: `creational_broken_tree/`
- family-prefixed root files: `creational_broken_tree.cpp.md`, `creational_symbol_test.cpp.md`

The result is spread-out ownership and repeated naming.

## Target Placement
```text
Pattern/
  BrokenTree/
    Creational/
      tree.cpp.md
  SymbolTest/
    Creational/
      symbol_test.cpp.md
  Hooks/
    Creational/
      builder.cpp.md
      factory.cpp.md
      singleton.cpp.md
      Common/
  Transform/
```

## Naming Rule
- Put `Creational` below the function folder.
- Keep `Builder`, `Factory`, and `Singleton` as file or subfolder units inside `Hooks/Creational/`, not as outer folders.
- Move shared creational hook support out of `Logic/` and into a concrete shared hook folder.
- Shorten filenames after the folder path already explains the common context.

## Migration Checks
- `Creational` is no longer the top-level owner of broken-tree, symbol-test, hook, and transform logic.
- `BrokenTree`, `SymbolTest`, `Hooks`, and `Transform` become the first readable boundaries.
- Repeated `creational_` prefixes disappear once the path already says `Creational`.
