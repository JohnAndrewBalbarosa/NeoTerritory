# pattern_hook_contract.cpp

## Role
Defines how pattern-specific algorithms plug into the middleman. The hook may be a virtual function, function pointer, or equivalent callback.

## Intended Source Role
This file maps to the future hook interface. Every Factory, Singleton, Builder, Strategy, Observer, or scaffold detector must fit this same callable shape.

## Hook Contract Flow
```mermaid
flowchart TD
    Start["Hook call"]
    N0["Receive context"]
    N1["Inspect target"]
    N2["Run algorithm"]
    N3["Return evidence"]
    End["Middleman resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Hook Rules
- Do not register classes.
- Do not register functions.
- Do not create root nodes.
- Do not assemble final trees.
- Do only pattern-specific logic.
- Return empty output when no match exists.

## Hook Inputs
- Shared context.
- Current class record.
- Related function records.
- Pattern options.
- Evidence sink.

## Hook Output
- Match flag.
- Pattern name.
- Target class.
- Related functions.
- Evidence notes.
- Confidence or reason.

## Rejection Flow
```mermaid
flowchart TD
    Start["Hook input"]
    N0["Check target"]
    D0{"Match?"}
    N1["Emit evidence"]
    N2["Emit empty"]
    End["Return result"]
    Start --> N0
    N0 --> D0
    D0 -->|yes| N1
    D0 -->|no| N2
    N1 --> End
    N2 --> End
```
