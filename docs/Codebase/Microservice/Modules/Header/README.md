# Header

- Folder: `docs/Codebase/Microservice/Modules/Header`
- Role: header-side contract map for the flattened syntactic analysis subsystem

## Read Order
1. `Analysis/`
2. `Trees/`
3. `HashingMechanism/`
4. `OutputGeneration/`

## Active Tree
```text
Header/
  Analysis/
    Input/
    Lexical/
    ImplementationUse/
    Patterns/
  Trees/
    Actual/
    Broken/
    Shared/
  HashingMechanism/
    HashLinks/
  OutputGeneration/
    Contracts/
    Render/
```

## Mirror Rule
- keep the same stage order as source
- keep the same logic-first folder names
- only diverge when a source-side implementation folder has no header contract equivalent
- do not reintroduce the old `SyntacticBrokenAST/` wrapper under `Header/`

## Boundary
- `README.md` is the Header navigation entry.
- Stage folders own the contract docs for their part of the source-side flow.
- Source-only stages stay outside this tree until they have real header contracts.

## Acceptance Checks
- `Header/` exposes stage folders directly, without a wrapper folder
- `Folder:` metadata in Header README files points at the flattened docs path
- header docs keep source parity where a matching header contract exists
