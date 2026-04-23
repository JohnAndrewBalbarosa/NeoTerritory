# parse_tree_symbols_internal_program_flow.hpp

- Source document: [parse_tree_symbols_internal.hpp.md](../parse_tree_symbols_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Promises this file makes"]
    N2["Enter trim()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave trim()"]
    N6["Enter starts_with()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave starts_with()"]
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
    N0["Enter split_words()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave split_words()"]
    N4["Enter class_name_from_signature()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave class_name_from_signature()"]
    N8["Enter function_name_from_signature()"]
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
    N1["Leave function_name_from_signature()"]
    N2["Enter function_parameter_hint_from_signature()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave function_parameter_hint_from_signature()"]
    N6["Enter build_function_key()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave build_function_key()"]
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
    N0["Enter is_main_function_name()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave is_main_function_name()"]
    N4["Enter is_class_block()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave is_class_block()"]
    N8["Enter is_function_block()"]
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
    N1["Leave is_function_block()"]
    N2["Enter is_candidate_usage_node()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave is_candidate_usage_node()"]
    N6["Enter extract_return_candidate_name()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave extract_return_candidate_name()"]
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
    N0["Enter build_symbol_tables_with_builder()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave build_symbol_tables_with_builder()"]
    N4["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```
