# symbols_builder_program_flow.cpp

- Source document: [symbols_builder.cpp.md](../symbols_builder.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Supporting steps"]
    N2["Enter symboltablebuilder()"]
    N3["Work symbols"]
    N4["Leave SymbolTableBuilder()"]
    N5["Building the working picture"]
    N6["Enter add_class_symbol()"]
    N7["Build output"]
    N8["Work symbols"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Look up entries"]
    N1["Record output"]
    N2["Assemble tree"]
    N3["Return result"]
    N4["Enter add_function_symbol()"]
    N5["Build output"]
    N6["Work symbols"]
    N7["Look up entries"]
    N8["Record output"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Compute hashes"]
    N1["Return result"]
    N2["Finding what matters"]
    N3["Enter collect_symbols_dfs()"]
    N4["Collect facts"]
    N5["Work symbols"]
    N6["Assemble tree"]
    N7["Compute hashes"]
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

#### Part 4
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Leave collect_symbols_dfs()"]
    N4["Enter collect_class_usages_dfs()"]
    N5["Collect facts"]
    N6["Register classes"]
    N7["Look up entries"]
    N8["Record output"]
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

#### Part 5
```mermaid
flowchart TD
    N0["Compute hashes"]
    N1["Leave collect_class_usages_dfs()"]
    N2["Building the working picture"]
    N3["Enter build_symbol_tables_with_builder()"]
    N4["Build output"]
    N5["Work symbols"]
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
