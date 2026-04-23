# creational_transform_evidence_render_program_flow.cpp

- Source document: [creational_transform_evidence_render.cpp.md](../creational_transform_evidence_render.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Building the working picture"]
    N2["Enter build_source_evidence_present_lines()"]
    N3["Build output"]
    N4["Read lines"]
    N5["More items?"]
    N6["Match regex"]
    N7["Record output"]
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
    N0["Return result"]
    N1["Enter build_target_evidence_removed_lines()"]
    N2["Build output"]
    N3["Read lines"]
    N4["More items?"]
    N5["Match regex"]
    N6["Record output"]
    N7["Clean text"]
    N8["Populate outputs"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Enter build_target_evidence_added_lines()"]
    N1["Build output"]
    N2["Read lines"]
    N3["More items?"]
    N4["Assemble tree"]
    N5["Serialize report"]
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
    N2["Enter append_evidence_section()"]
    N3["Loop collection"]
    N4["More items?"]
    N5["Branch condition"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Return result"]
    N9["Enter append_code_section()"]
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
    N0["Loop collection"]
    N1["More items?"]
    N2["Leave append_code_section()"]
    N3["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```
