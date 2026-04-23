# rewrite_class_instantiations_to_singleton_references.hpp

- Source document: [creational_code_generator_internal.hpp.md](../../creational_code_generator_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### rewrite_class_instantiations_to_singleton_references()
This declaration exposes a callable contract without providing the runtime body here. It appears near line 30.

Inside the body, it mainly handles declare a callable contract and let implementation files define the runtime body.

What it does:
- declare a callable contract
- let implementation files define the runtime body

Flow:
```mermaid
flowchart TD
    Start["rewrite_class_instantiations_to_singleton_references()"]
    N0["Enter rewrite_class_instantiations_to_singleton_references()"]
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
