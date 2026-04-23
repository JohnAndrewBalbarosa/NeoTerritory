# factory_pattern_logic_program_flow_01.cpp

- Source document: [factory_pattern_logic.cpp.md](../factory_pattern_logic.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Small preparation steps"]
    N2["Enter trim()"]
    N3["Normalize text"]
    N4["Clean text"]
    N5["Loop collection"]
    N6["More items?"]
    N7["Return result"]
    N8["Supporting steps"]
    N9["Enter to_lower()"]
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
    N0["Carry out to lower"]
    N1["Return result"]
    N2["Small preparation steps"]
    N3["Enter split_words()"]
    N4["Split text"]
    N5["Record output"]
    N6["Assemble tree"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Return result"]
    N3["Main path"]
    N4["Enter starts_with()"]
    N5["Drive path"]
    N6["Return result"]
    N7["Supporting steps"]
    N8["Enter class_name_from_signature()"]
    N9["Register classes"]
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
    N0["Look up entries"]
    N1["Loop collection"]
    N2["More items?"]
    N3["Branch condition"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Return result"]
    N7["Enter function_name_from_signature()"]
    N8["Look up entries"]
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

#### Part 5
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Checks before moving on"]
    N5["Enter is_class_block()"]
    N6["Register classes"]
    N7["Clean text"]
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

#### Part 6
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Enter is_function_block()"]
    N3["Look up entries"]
    N4["Clean text"]
    N5["Branch condition"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Return result"]
    N9["Enter is_conditional_block()"]
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
    N0["Clean text"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Return result"]
    N5["Supporting steps"]
    N6["Enter extract_return_expr()"]
    N7["Clean text"]
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

#### Part 8
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Enter extract_type_in_angle_brackets()"]
    N3["Look up entries"]
    N4["Clean text"]
    N5["Branch condition"]
    N6["Continue?"]
    N7["Stop path"]
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
