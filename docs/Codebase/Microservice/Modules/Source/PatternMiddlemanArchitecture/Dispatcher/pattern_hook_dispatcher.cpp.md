# pattern_hook_dispatcher.cpp

## Role
Selects Behavioural or Creational hook groups without creating separate middlemen.

## Intended Source Role
This file maps to the future dispatcher. It owns hook selection and hook calls. It does not own tree assembly.

## Dispatch Flow
```mermaid
flowchart TD
    Start["Dispatch request"]
    N0["Read family"]
    D0{"Family?"}
    N1["Use creational"]
    N2["Use behavioural"]
    N3["Call hooks"]
    End["Results ready"]
    Start --> N0
    N0 --> D0
    D0 -->|creational| N1
    D0 -->|behavioural| N2
    N1 --> N3
    N2 --> N3
    N3 --> End
```

## Hook Loop
```mermaid
flowchart TD
    Start["Hook list"]
    N0["Pick hook"]
    N1["Call hook"]
    N2["Store result"]
    L2{"More hooks?"}
    End["Dispatch done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> L2
    L2 -->|more| N0
    L2 -->|done| End
```

## Hook Selection
- Creational request loads Factory, Singleton, and Builder hooks.
- Behavioural request loads Strategy, Observer, and scaffold hooks.
- New pattern families add hook groups, not new middlemen.
- Disabled hooks are skipped by options.
- Failed hooks return diagnostics without breaking shared setup.

## Error Flow
```mermaid
flowchart TD
    Start["Call hook"]
    D0{"Failed?"}
    N0["Store error"]
    N1["Store result"]
    N2["Continue loop"]
    End["Return bundle"]
    Start --> D0
    D0 -->|yes| N0
    D0 -->|no| N1
    N0 --> N2
    N1 --> N2
    N2 --> End
```
