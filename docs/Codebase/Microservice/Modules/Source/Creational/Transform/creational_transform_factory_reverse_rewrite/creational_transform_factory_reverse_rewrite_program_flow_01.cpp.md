# creational_transform_factory_reverse_rewrite_program_flow_01.cpp

- Source document: [creational_transform_factory_reverse_rewrite.cpp.md](../creational_transform_factory_reverse_rewrite.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Supporting steps"]
    N2["Enter match_instance_declaration_for_class()"]
    N3["Register classes"]
    N4["Inspect declarations"]
    N5["Continue?"]
    N6["Stop path"]
    N7["Match regex"]
    N8["Clean text"]
    N9["Populate outputs"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Enter match_simple_variable_declaration()"]
    N5["Inspect declarations"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Match regex"]
    N9["Clean text"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Populate outputs"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Return result"]
    N5["Reading the input"]
    N6["Enter parse_allocation_expression()"]
    N7["Parse text"]
    N8["Match regex"]
    N9["Clean text"]
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

#### Part 4
```mermaid
flowchart TD
    N0["Populate outputs"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Return result"]
    N5["Checks before moving on"]
    N6["Enter is_auto_declaration_type()"]
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

#### Part 5
```mermaid
flowchart TD
    N0["Match regex"]
    N1["Return result"]
    N2["Changing or cleaning the picture"]
    N3["Enter rewrite_declaration_type()"]
    N4["Rewrite source"]
    N5["Inspect declarations"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Match regex"]
    N9["Clean text"]
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

#### Part 6
```mermaid
flowchart TD
    N0["Populate outputs"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Return result"]
    N5["Finding what matters"]
    N6["Enter resolve_variable_declaration_site()"]
    N7["Connect data"]
    N8["Inspect declarations"]
    N9["Continue?"]
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

#### Part 7
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Look up entries"]
    N2["Populate outputs"]
    N3["Loop collection"]
    N4["More items?"]
    N5["Branch condition"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Return result"]
    N9["Reading the input"]
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

#### Part 8
```mermaid
flowchart TD
    N0["Enter parse_factory_callsite_line()"]
    N1["Parse text"]
    N2["Handle factory"]
    N3["Read lines"]
    N4["More items?"]
    N5["Rewrite callsites"]
    N6["Match regex"]
    N7["Look up entries"]
    N8["Return result"]
    N9["Building the working picture"]
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
