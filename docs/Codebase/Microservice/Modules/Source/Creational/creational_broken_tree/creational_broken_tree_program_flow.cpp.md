# creational_broken_tree_program_flow.cpp

- Source document: [creational_broken_tree.cpp.md](../creational_broken_tree.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 2 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Building the working picture"]
    N2["Enter build_creational_broken_tree()"]
    N3["Build output"]
    N4["Assemble tree"]
    N5["Return result"]
    N6["Enter creational_tree_to_parse_tree_node()"]
    N7["Record output"]
    N8["Populate outputs"]
    N9["Tokenize input"]
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
    N0["Assemble tree"]
    N1["Loop collection"]
    N2["More items?"]
    N3["Return result"]
    N4["Showing the result"]
    N5["Enter creational_tree_to_html()"]
    N6["Tokenize input"]
    N7["Render views"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Enter creational_tree_to_text()"]
    N1["Populate outputs"]
    N2["Assemble tree"]
    N3["Serialize report"]
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

#### Part 4
```mermaid
flowchart TD
    N0["End"]
```
