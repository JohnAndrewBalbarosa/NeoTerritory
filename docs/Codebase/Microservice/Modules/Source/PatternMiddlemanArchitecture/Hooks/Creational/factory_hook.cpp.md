# factory_hook.cpp

## Role
Detects factory evidence from the shared middleman context.

## Intended Source Role
This file maps to the Factory hook implementation. It should only contain Factory-specific checks.

## Hook Flow
```mermaid
flowchart TD
    Start["Factory hook"]
    N0["Read class"]
    N1["Scan methods"]
    N2["Check returns"]
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
2. Find methods that construct or return other types.
3. Compare return types against registered classes.
4. Confirm object creation or delegated creation evidence.
5. Return Factory evidence to dispatcher.

## Evidence Fields
- Factory class.
- Factory method.
- Produced type.
- Creation call.
- Confidence reason.
