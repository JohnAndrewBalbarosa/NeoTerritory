# icreationaltreecreator.hpp

- Source document: [creational_broken_tree.hpp.md](../../creational_broken_tree.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### ICreationalTreeCreator
This declaration introduces a shared type that other files compile against. It appears near line 22.

Inside the body, it mainly handles declare a shared type and expose the compile-time contract.

What it does:
- declare a shared type
- expose the compile-time contract

Flow:
```mermaid
flowchart TD
    Start["ICreationalTreeCreator"]
    N0["Enter icreationaltreecreator()"]
    N1["Declare type"]
    N2["Expose contract"]
    N3["Hand back"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
