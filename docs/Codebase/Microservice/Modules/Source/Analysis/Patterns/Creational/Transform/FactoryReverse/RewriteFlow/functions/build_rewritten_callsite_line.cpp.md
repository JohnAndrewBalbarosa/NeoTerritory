# build_rewritten_callsite_line.cpp

- Source document: [creational_transform_factory_reverse_rewrite.cpp.md](../../creational_transform_factory_reverse_rewrite.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### build_rewritten_callsite_line()
This routine assembles a larger structure from the inputs it receives. It appears near line 420.

Inside the body, it mainly handles build or append the next output structure, work one source line at a time, and recognize or rewrite callsite structure.

The caller receives a computed result or status from this step.

What it does:
- build or append the next output structure
- work one source line at a time
- recognize or rewrite callsite structure

Flow:
```mermaid
flowchart TD
    Start["build_rewritten_callsite_line()"]
    N0["Enter build_rewritten_callsite_line()"]
    N1["Build output"]
    N2["Read lines"]
    L2{"More items?"}
    N3["Rewrite callsites"]
    N4["Return result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> L2
    L2 -->|more| N2
    L2 -->|done| N3
    N3 --> N4
    N4 --> End
```
