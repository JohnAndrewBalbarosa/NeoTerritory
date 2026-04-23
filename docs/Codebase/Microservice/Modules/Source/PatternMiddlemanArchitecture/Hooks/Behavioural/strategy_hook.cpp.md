# strategy_hook.cpp

## Role
Detects strategy evidence from the shared middleman context.

## Intended Source Role
This file maps to the Strategy hook implementation. It should only contain Strategy-specific checks.

## Hook Flow
```mermaid
flowchart TD
    Start["Strategy hook"]
    N0["Read class"]
    N1["Read methods"]
    N2["Check strategy"]
    N3["Return evidence"]
    End["Hook done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Algorithm Steps
1. Read candidate context classes.
2. Find interchangeable behaviour references.
3. Find setter or constructor injection.
4. Find delegated behaviour calls.
5. Return Strategy evidence to dispatcher.

## Evidence Fields
- Context class.
- Strategy interface.
- Concrete strategy.
- Delegated method.
- Confidence reason.
