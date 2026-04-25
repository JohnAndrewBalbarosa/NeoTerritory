# pattern_registry.cpp

## Role
Creates one shared registry from completed class declarations for Behavioural and Creational hooks. This prevents each pattern from walking the parse tree and registering the same classes again.

## Intended Source Role
This file maps to the future registry builder. It should be called once by the middleman after class declaration generation and before any pattern hook runs.

## Registry Flow
```mermaid
flowchart TD
    Start["Declarations"]
    N0["Read class facts"]
    N1["Find classes"]
    N2["Find functions"]
    N3["Create records"]
    N4["Store registry"]
    End["Registry ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Class Record
```mermaid
flowchart TD
    Start["Class node"]
    N0["Read name"]
    N1["Read signature"]
    N2["Read hash"]
    N3["Attach symbol"]
    End["Class record"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Function Record
```mermaid
flowchart TD
    Start["Function node"]
    N0["Read name"]
    N1["Read owner"]
    N2["Read signature"]
    N3["Attach symbol"]
    End["Function record"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Registry Tables
- Class table by name.
- Class table by node id.
- Function table by name.
- Method table by owner.
- Constructor table by class.
- Reference table by symbol.

## Build Steps
```mermaid
flowchart TD
    Start["Parse tree"]
    N0["Visit type nodes"]
    N1["Visit functions"]
    N2["Link owners"]
    N3["Index records"]
    N4["Freeze registry"]
    End["Registry ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Duplicate Policy
```mermaid
flowchart TD
    Start["New record"]
    D0{"Exists?"}
    N0["Merge facts"]
    N1["Insert record"]
    N2["Keep source"]
    End["Table ready"]
    Start --> D0
    D0 -->|yes| N0
    D0 -->|no| N1
    N0 --> N2
    N1 --> N2
    N2 --> End
```
