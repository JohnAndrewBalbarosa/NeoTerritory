# pattern_middleman.cpp

## Role
Coordinates registry, context, dispatcher, and assembler. This is the one middleman for Behavioural and Creational pattern logic.

## Intended Source Role
This file maps to the future orchestration implementation. It is the only module that knows the complete shared process.

## Orchestration Flow
```mermaid
flowchart TD
    Start["Pattern request"]
    N0["Build registry"]
    N1["Build context"]
    N2["Dispatch hooks"]
    N3["Connect local nodes"]
    N4["Return output"]
    End["Done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Ownership
- Calls registry.
- Calls context builder.
- Calls dispatcher.
- Calls assembler.
- Does not run pattern algorithms directly.
- Does not duplicate Behavioural and Creational paths.

## Detailed Steps
1. Validate the request through the middleman contract.
2. Build one registry from the parse root.
3. Create one context from request and registry data.
4. Ask dispatcher for the correct hook group.
5. Run hooks through the hook contract.
6. Pass hook results to assembler.
7. Return one final tree to the caller.

## Shared Setup Flow
```mermaid
flowchart TD
    Start["Request"]
    N0["Validate"]
    N1["Register once"]
    N2["Create context"]
    N3["Choose hooks"]
    End["Ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Output Flow
```mermaid
flowchart TD
    Start["Hook bundle"]
    N0["Send assembler"]
    N1["Build tree"]
    N2["Add diagnostics"]
    N3["Return local result"]
    End["Caller resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
