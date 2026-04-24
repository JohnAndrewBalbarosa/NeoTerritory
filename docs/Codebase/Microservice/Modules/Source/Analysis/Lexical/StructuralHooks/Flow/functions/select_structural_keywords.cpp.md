# select_structural_keywords.cpp

- Source document: [lexical_structure_hooks.cpp.md](../../lexical_structure_hooks.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### select_structural_keywords()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles fill local output fields and branch on local conditions.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- fill local output fields
- branch on local conditions

Flow:
```mermaid
flowchart TD
    Start["select_structural_keywords()"]
    N0["Select structural keywords"]
    N1["Populate outputs"]
    N2["Check local condition"]
    D2{"Continue?"}
    R2["Return early path"]
    N3["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> D2
    D2 -->|yes| N3
    D2 -->|no| R2
    R2 --> End
    N3 --> End
```
