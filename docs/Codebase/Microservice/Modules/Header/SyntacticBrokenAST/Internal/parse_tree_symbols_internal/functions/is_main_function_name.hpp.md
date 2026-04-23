# is_main_function_name.hpp

- Source document: [parse_tree_symbols_internal.hpp.md](../../parse_tree_symbols_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### is_main_function_name()
This declaration exposes a callable contract without providing the runtime body here. It appears near line 23.

Inside the body, it mainly handles declare a callable contract and let implementation files define the runtime body.

What it does:
- declare a callable contract
- let implementation files define the runtime body

Flow:
```mermaid
flowchart TD
    Start["is_main_function_name()"]
    N0["Enter is_main_function_name()"]
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
