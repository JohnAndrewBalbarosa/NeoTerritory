# pattern_context.cpp

## Role
Bundles parse root, symbol tables, registered classes, registered functions, family selection, and options into one object passed to every hook.

## Intended Source Role
This file maps to the future context object. It is the read-only shared state passed into hooks so each hook does not rebuild the same information.

## Context Flow
```mermaid
flowchart TD
    Start["Build context"]
    N0["Attach parse root"]
    N1["Attach symbols"]
    N2["Attach registry"]
    N3["Attach family"]
    N4["Attach options"]
    End["Context ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Shared Data
- Parse root.
- Symbol tables.
- Class registry.
- Function registry.
- Pattern family.
- Hook options.

## Context Sections
- Request section.
- Registry section.
- Symbol section.
- Family section.
- Option section.
- Diagnostic section.

## Access Flow
```mermaid
flowchart TD
    Start["Hook asks"]
    N0["Read context"]
    N1["Find class"]
    N2["Find methods"]
    N3["Read options"]
    End["Hook decides"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Mutation Rule
Hooks should treat context as read-only. If a hook finds evidence, it returns evidence to the dispatcher. It does not write back into the shared context.
