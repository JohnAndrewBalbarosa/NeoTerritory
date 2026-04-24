# collect_class_definitions_by_file.hpp

- Source document: [parse_tree_internal.hpp.md](../../parse_tree_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### collect_class_definitions_by_file()
This declaration exposes a callable contract without providing the runtime body here. It appears near line 105.

Inside the body, it mainly handles declare a callable contract and let implementation files define the runtime body.

What it does:
- declare a callable contract
- let implementation files define the runtime body

Flow:
```mermaid
flowchart TD
    Start["collect_class_definitions_by_file()"]
    N0["Enter collect_class_definitions_by_file()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Hand back"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
