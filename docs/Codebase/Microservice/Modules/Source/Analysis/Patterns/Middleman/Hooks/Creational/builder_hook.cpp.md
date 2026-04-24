# builder_hook.cpp

## Role
Detects builder evidence from the shared middleman context.

## Intended Source Role
This file maps to the Builder hook implementation. It should only contain Builder-specific checks.

## Hook Flow
```mermaid
flowchart TD
    Start["Builder hook"]
    N0["Read class"]
    N1["Scan methods"]
    N2["Check chain"]
    N3["Return evidence"]
    End["Hook done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Algorithm Steps
1. Read each registered class from context.
2. Find chained setter-like methods.
3. Find final build or create method.
4. Link builder methods to produced type.
5. Return Builder evidence to dispatcher.

## Evidence Fields
- Builder class.
- Chain methods.
- Build method.
- Produced type.
- Confidence reason.
