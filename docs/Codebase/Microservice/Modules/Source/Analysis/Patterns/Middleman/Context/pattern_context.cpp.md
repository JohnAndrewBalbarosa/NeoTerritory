# pattern_context.cpp

## Role
Bundles parse root, symbol tables, generated class declarations, ordered class token streams, registered classes, registered functions, catalog definitions, and options into one object passed to every hook.

## Intended Source Role
This file maps to the future context object. It is the read-only shared state passed into hooks so each hook does not rebuild the same information or reload catalog data.

## Context Flow
```mermaid
flowchart TD
    Start["Build context"]
    N0["Attach parse root"]
    N1["Attach symbols"]
    N2["Attach registry"]
    N3["Attach declarations"]
    N4["Attach token evidence"]
    N5["Attach catalog"]
    N6["Attach options"]
    End["Context ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> End
```

## Shared Data
- Parse root.
- Symbol tables.
- Generated class declarations.
- Ordered class token streams.
- Token-sequence evidence.
- Class registry.
- Function registry.
- Pattern catalog definitions.
- Hook options.

## Context Sections
- Request section.
- Catalog section.
- Registry section.
- Symbol section.
- Declaration section.
- Option section.
- Diagnostic section.

## Access Flow
```mermaid
flowchart TD
    Start["Hook asks"]
    N0["Read context"]
    N1["Read pattern"]
    N2["Find class"]
    N3["Find methods"]
    N4["Read options"]
    End["Hook decides"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Mutation Rule
Hooks should treat context as read-only. If a hook finds evidence, it returns evidence to the dispatcher. It does not write back into the shared context.
