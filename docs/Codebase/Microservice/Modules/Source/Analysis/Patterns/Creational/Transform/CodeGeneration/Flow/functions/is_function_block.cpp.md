# is_function_block.cpp

- Source document: [creational_code_generator_internal.cpp.md](../../creational_code_generator_internal.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### is_function_block()
This routine owns one focused piece of the file's behavior. It appears near line 115.

Inside the body, it mainly handles look up entries in previously collected maps or sets, normalize raw text before later parsing, and branch on runtime conditions.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- look up entries in previously collected maps or sets
- normalize raw text before later parsing
- branch on runtime conditions

Flow:
```mermaid
flowchart TD
    Start["is_function_block()"]
    N0["Enter is_function_block()"]
    N1["Look up entries"]
    N2["Clean text"]
    N3["Branch condition"]
    D3{"Continue?"}
    R3["Stop path"]
    N4["Return result"]
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
