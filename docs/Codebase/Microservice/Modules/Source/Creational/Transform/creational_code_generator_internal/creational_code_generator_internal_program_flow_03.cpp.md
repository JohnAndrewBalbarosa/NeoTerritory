# creational_code_generator_internal_program_flow_03.cpp

- Source document: [creational_code_generator_internal.cpp.md](../creational_code_generator_internal.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 17
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Building the working picture"]
    N5["Enter append_unique_token()"]
    N6["Record output"]
    N7["Populate outputs"]
    N8["Assemble tree"]
    N9["Loop collection"]
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

#### Part 18
```mermaid
flowchart TD
    N0["More items?"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Return result"]
    N5["Enter append_unique_line()"]
    N6["Read lines"]
    N7["More items?"]
    N8["Clean text"]
    N9["Assemble tree"]
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

#### Part 19
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Enter append_unique_lines()"]
    N5["Read lines"]
    N6["More items?"]
    N7["Assemble tree"]
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

#### Part 20
```mermaid
flowchart TD
    N0["Leave append_unique_lines()"]
    N1["Supporting steps"]
    N2["Enter regex_capture_or_empty()"]
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
