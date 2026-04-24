# append_unique_lines.cpp

- Source document: [creational_code_generator_internal.cpp.md](../../core.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### append_unique_lines()
This helper reshapes small pieces of data so the surrounding code can stay readable.

Inside the body, it mainly handles work one source line at a time, connect local structures, and walk the local collection.

The implementation iterates over a collection or repeated workload.

What it does:
- work one source line at a time
- connect local structures
- walk the local collection

Flow:
```mermaid
flowchart TD
    Start["append_unique_lines()"]
    N0["Append unique line s"]
    N1["Read lines"]
    L1{"More items?"}
    N2["Connect local nodes"]
    N3["Loop collection"]
    L3{"More items?"}
    N4["Hand back"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> L1
    L1 -->|more| N1
    L1 -->|done| N2
    N2 --> N3
    N3 --> L3
    L3 -->|more| N3
    L3 -->|done| N4
    N4 --> End
```
