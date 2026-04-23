# current_to_middleman.cpp

## Role
Maps the current docs/code layout to the intended middleman-shaped implementation.

## Intended Source Role
This file is not a runtime module. It is the migration checklist for converting current scattered pattern logic into the implementation-shaped docs in this folder.

## Migration Flow
```mermaid
flowchart TD
    Start["Current files"]
    N0["Find duplicates"]
    N1["Move registry"]
    N2["Move assembly"]
    N3["Keep algorithms"]
    N4["Wire hooks"]
    End["Middleman shape"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Migration Rules
- Keep one middleman.
- Move class registration to Registry.
- Move function registration to Registry.
- Move shared state to Context.
- Move hook calls to Dispatcher.
- Move tree output to Assembler.
- Keep Factory logic in factory hook.
- Keep Singleton logic in singleton hook.
- Keep Builder logic in builder hook.
- Keep Strategy logic in strategy hook.
- Keep Observer logic in observer hook.

## Refactor Order
```mermaid
flowchart TD
    Start["Current logic"]
    N0["Extract registry"]
    N1["Extract context"]
    N2["Extract hooks"]
    N3["Extract assembler"]
    N4["Wire middleman"]
    End["Target shape"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Acceptance Checks
- Behavioural and Creational call one middleman.
- Each pattern hook uses the same context type.
- Class registration runs once per request.
- Function registration runs once per request.
- Tree root creation happens only in assembler.
- No pattern file owns shared assembly steps.
