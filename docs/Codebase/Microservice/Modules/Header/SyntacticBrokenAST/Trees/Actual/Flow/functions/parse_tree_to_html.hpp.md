# parse_tree_to_html.hpp

- Source document: [parse_tree.hpp.md](../../parse_tree.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### parse_tree_to_html()
This declaration exposes a callable contract without providing the runtime body here.

Inside the body, it mainly handles declare a callable contract and let implementation files define the runtime body.

What it does:
- declare a callable contract
- let implementation files define the runtime body

Flow:
```mermaid
flowchart TD
    Start["parse_tree_to_html()"]
    N0["Parse tree to html"]
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
