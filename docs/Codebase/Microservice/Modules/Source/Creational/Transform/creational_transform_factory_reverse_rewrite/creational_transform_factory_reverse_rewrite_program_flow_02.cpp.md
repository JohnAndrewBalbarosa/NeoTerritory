# creational_transform_factory_reverse_rewrite_program_flow_02.cpp

- Source document: [creational_transform_factory_reverse_rewrite.cpp.md](../creational_transform_factory_reverse_rewrite.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 9
```mermaid
flowchart TD
    N0["Enter build_rewritten_callsite_line()"]
    N1["Build output"]
    N2["Read lines"]
    N3["More items?"]
    N4["Rewrite callsites"]
    N5["Return result"]
    N6["Enter build_rewritten_assignment_line()"]
    N7["Build output"]
    N8["Read lines"]
    N9["More items?"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 10
```mermaid
flowchart TD
    N0["Return result"]
    N1["Changing or cleaning the picture"]
    N2["Enter rewrite_variable_declaration_line()"]
    N3["Rewrite source"]
    N4["Read lines"]
    N5["More items?"]
    N6["Inspect declarations"]
    N7["Continue?"]
    N8["Stop path"]
    N9["Match regex"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 11
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Enter remove_unused_factory_instance_declaration()"]
    N5["Remove obsolete"]
    N6["Handle factory"]
    N7["Inspect declarations"]
    N8["Continue?"]
    N9["Stop path"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 12
```mermaid
flowchart TD
    N0["Match regex"]
    N1["Drop stale data"]
    N2["Loop collection"]
    N3["More items?"]
    N4["Return result"]
    N5["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
```
