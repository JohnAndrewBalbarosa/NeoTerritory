# creational_broken_tree_program_flow.hpp

- Source document: [creational_broken_tree.hpp.md](../creational_broken_tree.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Promises this file makes"]
    N2["Enter creationaltreenode"]
    N3["Declare type"]
    N4["Expose contract"]
    N5["Leave CreationalTreeNode"]
    N6["Enter icreationaldetector"]
    N7["Declare type"]
    N8["Expose contract"]
    N9["Leave ICreationalDetector"]
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
    N0["Enter icreationaltreecreator"]
    N1["Declare type"]
    N2["Expose contract"]
    N3["Leave ICreationalTreeCreator"]
    N4["Enter build_creational_broken_tree()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave build_creational_broken_tree()"]
    N8["Enter creational_tree_to_parse_tree_node()"]
    N9["Declare call"]
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
    N0["Defer body"]
    N1["Leave creational_tree_to_parse_tree_node()"]
    N2["Enter creational_tree_to_html()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave creational_tree_to_html()"]
    N6["Enter creational_tree_to_text()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave creational_tree_to_text()"]
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
