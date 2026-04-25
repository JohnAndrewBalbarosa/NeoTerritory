# pattern_hook_dispatcher.cpp

## Role
Iterates enabled catalog definitions and selects Behavioural or Creational hook groups without creating separate middlemen.

## Intended Source Role
This file maps to the future dispatcher. It owns all-pattern iteration, token-sequence evidence routing, hook selection, and hook calls. It does not own tree assembly.

## Dispatch Flow
```mermaid
flowchart TD
    Start["Dispatch request"]
    N0["Read token evidence"]
    N1["Pick pattern"]
    D0{"Family?"}
    N2["Use creational"]
    N3["Use behavioural"]
    N4["Call hooks"]
    N5["Store evidence"]
    End["Results ready"]
    Start --> N0
    N0 --> N1
    N1 --> D0
    D0 -->|creational| N2
    D0 -->|behavioural| N3
    N2 --> N4
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Pattern Loop
```mermaid
flowchart TD
    Start["Pattern list"]
    N0["Pick pattern"]
    N1["Pick class"]
    N2["Call hooks"]
    N3["Store result"]
    L3{"More checks?"}
    End["Dispatch done"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> L3
    L3 -->|more| N0
    L3 -->|done| End
```

## Hook Selection
- Creational catalog entries can load Factory, Singleton, and Builder hooks.
- Behavioural catalog entries can load Strategy, Observer, and scaffold hooks.
- New pattern families add hook groups, not new middlemen.
- Disabled hooks are skipped by options.
- Failed hooks return diagnostics without breaking shared setup.
- Default behavior checks all enabled catalog entries against every completed class declaration.
- Token-sequence evidence from `../../Catalog/pattern_token_sequence_matcher.cpp.md` is passed to hooks before family-specific logic runs.

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
