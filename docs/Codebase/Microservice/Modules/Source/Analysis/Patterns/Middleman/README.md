# PatternMiddlemanArchitecture

- Folder: `docs/Codebase/Microservice/Modules/Source/PatternMiddlemanArchitecture`
- Purpose: current shared pattern-function subtree
- Status: function-first internally, wrong outer placement

## Current Contents
```text
PatternMiddlemanArchitecture/
  Assembler/
  Context/
  Contracts/
  Dispatcher/
  Hooks/
  Middleman/
  Migration/
  Registry/
```

## Structure Reading
This subtree already shows the right inner rule:
- first folder = function
- pattern-specific implementation appears only under `Hooks/`

The problem is that this good function-first shape is isolated in a separate outer folder while the actual pattern files still live in `Behavioural/` and `Creational/`.

## Required Rewrite
This subtree should stop being a standalone architecture branch and become the shared function core of the pattern subsystem.

## Target Placement
```text
Pattern/
  Contracts/
  Registry/
  Context/
  Dispatcher/
  Assembler/
  Middleman/
  Hooks/
    Behavioural/
    Creational/
  BrokenTree/
  SymbolTest/
  Transform/
```

## Concrete Mapping
- `PatternMiddlemanArchitecture/Contracts/` becomes `Pattern/Contracts/`.
- `PatternMiddlemanArchitecture/Registry/` becomes `Pattern/Registry/`.
- `PatternMiddlemanArchitecture/Context/` becomes `Pattern/Context/`.
- `PatternMiddlemanArchitecture/Dispatcher/` becomes `Pattern/Dispatcher/`.
- `PatternMiddlemanArchitecture/Assembler/` becomes `Pattern/Assembler/`.
- `PatternMiddlemanArchitecture/Middleman/` becomes `Pattern/Middleman/`.
- `PatternMiddlemanArchitecture/Hooks/Behavioural/` becomes `Pattern/Hooks/Behavioural/`.
- `PatternMiddlemanArchitecture/Hooks/Creational/` becomes `Pattern/Hooks/Creational/`.

## Naming Rule
- Keep the function folders.
- Change the outer folder to the actual subsystem name.
- Do not keep architecture style as the outer grouping rule.
- Shorten file names after the function folder already provides the common meaning.

## Acceptance Checks
- Shared pattern logic is stored directly under the pattern subsystem.
- `Hooks/` is the only place where design-pattern families branch.
- A reader reaches function folders before family folders.
