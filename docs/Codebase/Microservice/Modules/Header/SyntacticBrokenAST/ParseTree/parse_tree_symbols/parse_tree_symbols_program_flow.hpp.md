# parse_tree_symbols_program_flow.hpp

- Source document: [parse_tree_symbols.hpp.md](../parse_tree_symbols.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Promises this file makes"]
    N2["Enter parsesymbol"]
    N3["Declare type"]
    N4["Expose contract"]
    N5["Leave ParseSymbol"]
    N6["Enter parsesymbolusage"]
    N7["Declare type"]
    N8["Expose contract"]
    N9["Leave ParseSymbolUsage"]
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
    N0["Enter parsetreesymbolbuildoptions"]
    N1["Declare type"]
    N2["Expose contract"]
    N3["Leave ParseTreeSymbolBuildOptions"]
    N4["Enter parsetreesymboltables"]
    N5["Declare type"]
    N6["Expose contract"]
    N7["Leave ParseTreeSymbolTables"]
    N8["Enter class_symbol_table()"]
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
    N1["Leave class_symbol_table()"]
    N2["Enter function_symbol_table()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave function_symbol_table()"]
    N6["Enter class_usage_table()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave class_usage_table()"]
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
    N0["Enter find_class_by_name()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave find_class_by_name()"]
    N4["Enter find_class_by_hash()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave find_class_by_hash()"]
    N8["Enter find_function_by_name()"]
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

#### Part 5
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave find_function_by_name()"]
    N2["Enter find_function_by_key()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave find_function_by_key()"]
    N6["Enter find_functions_by_name()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave find_functions_by_name()"]
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
    N0["Enter find_class_usages_by_name()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave find_class_usages_by_name()"]
    N4["Enter return_targets_known_class()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave return_targets_known_class()"]
    N8["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
```
