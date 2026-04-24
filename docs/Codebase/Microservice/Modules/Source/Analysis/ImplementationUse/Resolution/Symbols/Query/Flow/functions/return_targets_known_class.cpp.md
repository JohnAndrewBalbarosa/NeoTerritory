# return_targets_known_class.cpp

- Source document: [symbols_queries.cpp.md](../../symbols_queries.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### return_targets_known_class()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles inspect or register class-level information, read local tokens, and branch on local conditions.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- inspect or register class-level information
- read local tokens
- branch on local conditions

Flow:
```mermaid
flowchart TD
    Start["return_targets_known_class()"]
    N0["Execute file-local step"]
    N1["Register classes"]
    N2["Read structured tokens"]
    N3["Check local condition"]
    D3{"Continue?"}
    R3["Return early path"]
    N4["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> D3
    D3 -->|yes| N4
    D3 -->|no| R3
    R3 --> End
    N4 --> End
```
