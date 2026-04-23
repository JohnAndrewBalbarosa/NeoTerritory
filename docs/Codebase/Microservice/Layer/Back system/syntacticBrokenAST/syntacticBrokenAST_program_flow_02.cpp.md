# syntacticBrokenAST_program_flow_02.cpp

- Source document: [syntacticBrokenAST.cpp.md](../syntacticBrokenAST.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 9
```mermaid
flowchart TD
    N0["Check invariants"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Loop collection"]
    N4["More items?"]
    N5["Leave print_performance_report()"]
    N6["Enter print_symbol_diagnostics()"]
    N7["Render output"]
    N8["Work symbols"]
    N9["Compute hashes"]
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
    N0["Loop collection"]
    N1["More items?"]
    N2["Leave print_symbol_diagnostics()"]
    N3["Enter print_design_pattern_tags()"]
    N4["Render output"]
    N5["Loop collection"]
    N6["More items?"]
    N7["Leave print_design_pattern_tags()"]
    N8["Main path"]
    N9["Enter run_syntactic_broken_ast()"]
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
    N0["Drive path"]
    N1["Populate outputs"]
    N2["Write artifacts"]
    N3["Tokenize input"]
    N4["Compute hashes"]
    N5["Render views"]
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
