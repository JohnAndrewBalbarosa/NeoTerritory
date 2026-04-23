# symbols_queries_program_flow.cpp

- Source document: [symbols_queries.cpp.md](../symbols_queries.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Supporting steps"]
    N2["Enter class_symbol_table()"]
    N3["Work symbols"]
    N4["Register classes"]
    N5["Return result"]
    N6["Enter function_symbol_table()"]
    N7["Work symbols"]
    N8["Return result"]
    N9["Enter class_usage_table()"]
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
    N0["Register classes"]
    N1["Return result"]
    N2["Finding what matters"]
    N3["Enter find_class_by_name()"]
    N4["Search data"]
    N5["Register classes"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Enter find_class_by_hash()"]
    N3["Search data"]
    N4["Use hashes"]
    N5["Register classes"]
    N6["Compute hashes"]
    N7["Loop collection"]
    N8["More items?"]
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

#### Part 4
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Return result"]
    N3["Enter find_function_by_name()"]
    N4["Search data"]
    N5["Loop collection"]
    N6["More items?"]
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
    N1["Enter find_function_by_key()"]
    N2["Search data"]
    N3["Loop collection"]
    N4["More items?"]
    N5["Branch condition"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Return result"]
    N9["Enter find_functions_by_name()"]
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
    N0["Search data"]
    N1["Record output"]
    N2["Populate outputs"]
    N3["Assemble tree"]
    N4["Loop collection"]
    N5["More items?"]
    N6["Branch condition"]
    N7["Continue?"]
    N8["Stop path"]
    N9["Return result"]
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
    N0["Enter find_class_usages_by_name()"]
    N1["Search data"]
    N2["Register classes"]
    N3["Record output"]
    N4["Populate outputs"]
    N5["Assemble tree"]
    N6["Loop collection"]
    N7["More items?"]
    N8["Return result"]
    N9["Supporting steps"]
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
    N0["Enter return_targets_known_class()"]
    N1["Register classes"]
    N2["Tokenize input"]
    N3["Branch condition"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Return result"]
    N7["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
```
