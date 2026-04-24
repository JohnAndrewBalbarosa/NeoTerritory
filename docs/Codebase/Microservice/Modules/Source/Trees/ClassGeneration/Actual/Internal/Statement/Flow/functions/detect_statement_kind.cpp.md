# detect_statement_kind.cpp

- Source document: [statement.cpp.md](../../statement.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### detect_statement_kind()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles look up local indexes, walk the local collection, and branch on local conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- look up local indexes
- walk the local collection
- branch on local conditions

Flow:
```mermaid
flowchart TD
    Start["detect_statement_kind()"]
    N0["Handle detect statement kind"]
    N1["Look up entries"]
    N2["Loop collection"]
    L2{"More items?"}
    N3["Check local condition"]
    D3{"Continue?"}
    R3["Return early path"]
    N4["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> L2
    L2 -->|more| N2
    L2 -->|done| N3
    N3 --> D3
    D3 -->|yes| N4
    D3 -->|no| R3
    R3 --> End
    N4 --> End
```
