# Migration

## Purpose
These migration notes should convert the current docs tree from mixed grouping rules to one logic-first pattern subtree.

## Current Split To Remove
```text
Source/
  Behavioural/
  Creational/
  PatternMiddlemanArchitecture/
```

## Target Split
```text
Source/
  Pattern/
    Contracts/
    Registry/
    Context/
    Dispatcher/
    Assembler/
    Middleman/
    BrokenTree/
    SymbolTest/
    Hooks/
    Transform/
```

## Migration Sequence
1. Move shared folders from `PatternMiddlemanArchitecture/` into `Pattern/`.
2. Move `behavioural_broken_tree` and `creational_broken_tree` content under `Pattern/BrokenTree/`.
3. Move `behavioural_symbol_test` and `creational_symbol_test` content under `Pattern/SymbolTest/`.
4. Move Builder, Factory, Singleton, Strategy, Observer, and scaffold logic under `Pattern/Hooks/`.
5. Keep `Transform/` as its own function folder.
6. Shorten filenames after the folder path already carries the overlap.

## Acceptance Checks
- One outer pattern subtree replaces the current three-way split.
- Function folders come before family folders.
- Family prefixes are removed from file names when the path already carries that meaning.
