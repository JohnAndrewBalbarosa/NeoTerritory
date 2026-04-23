# statement_program_flow.cpp

- Source document: [statement.cpp.md](../statement.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Checks before moving on"]
    N2["Enter is_type_keyword()"]
    N3["Look up entries"]
    N4["Return result"]
    N5["Supporting steps"]
    N6["Enter detect_statement_kind()"]
    N7["Look up entries"]
    N8["Loop collection"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Checks before moving on"]
    N5["Enter is_class_or_struct_signature()"]
    N6["Register classes"]
    N7["Look up entries"]
    N8["Tokenize input"]
    N9["Branch condition"]
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
    N0["Continue?"]
    N1["Stop path"]
    N2["Return result"]
    N3["Enter is_function_signature()"]
    N4["Look up entries"]
    N5["Tokenize input"]
    N6["Loop collection"]
    N7["More items?"]
    N8["Branch condition"]
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

#### Part 4
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Enter is_class_declaration_node()"]
    N3["Register classes"]
    N4["Inspect declarations"]
    N5["Continue?"]
    N6["Stop path"]
    N7["Branch condition"]
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
    N0["Return result"]
    N1["Enter is_global_function_declaration_node()"]
    N2["Inspect declarations"]
    N3["Continue?"]
    N4["Stop path"]
    N5["Return result"]
    N6["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
```
