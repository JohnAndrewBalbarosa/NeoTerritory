# pattern_middleman.cpp

## Role
Coordinates catalog definitions, registry, context, dispatcher, and assembler. This is the one middleman for automated pattern logic across supported families.

## Intended Source Role
This file maps to the future orchestration implementation. It is the only module that knows the complete shared process after catalog parsing has completed.

## Orchestration Flow
```mermaid
flowchart TD
    Start["Recognition request"]
    N0["Receive catalog"]
    N1["Build registry"]
    N2["Build context"]
    N3["Dispatch all patterns"]
    N4["Assemble matches"]
    N5["Return output"]
    End["Done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Ownership
- Uses catalog definitions that were already parsed and validated.
- Calls registry.
- Calls context builder.
- Calls dispatcher.
- Calls assembler.
- Does not run pattern algorithms directly.
- Does not duplicate Behavioural and Creational paths.

## Detailed Steps
1. Validate the recognition request through the middleman contract.
2. Receive normalized catalog definitions.
3. Build one registry from generated class declarations and parse data.
4. Create one context from request, catalog, registry, and symbol data.
5. Ask dispatcher to check every enabled catalog pattern.
6. Run needed hooks through the hook contract.
7. Pass evidence results to assembler.
8. Return one final pattern result to the caller.

## Shared Setup Flow
```mermaid
flowchart TD
    Start["Recognition request"]
    N0["Validate"]
    N1["Attach catalog"]
    N2["Register once"]
    N3["Create context"]
    N4["Prepare checks"]
    End["Ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Output Flow
```mermaid
flowchart TD
    Start["Evidence bundle"]
    N0["Send assembler"]
    N1["Build result"]
    N2["Add diagnostics"]
    N3["Return local result"]
    End["Caller resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
