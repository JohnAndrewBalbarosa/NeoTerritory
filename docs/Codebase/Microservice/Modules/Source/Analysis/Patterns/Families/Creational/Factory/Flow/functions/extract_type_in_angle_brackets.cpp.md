# extract_type_in_angle_brackets.cpp

- Source document: [factory_pattern_logic.cpp.md](../../core.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### extract_type_in_angle_brackets()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles look up local indexes, normalize raw text before later parsing, and branch on local conditions.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- look up local indexes
- normalize raw text before later parsing
- branch on local conditions

Flow:
```mermaid
flowchart TD
    Start["extract_type_in_angle_brackets()"]
    N0["Execute file-local step"]
    N1["Look up entries"]
    N2["Clean text"]
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
