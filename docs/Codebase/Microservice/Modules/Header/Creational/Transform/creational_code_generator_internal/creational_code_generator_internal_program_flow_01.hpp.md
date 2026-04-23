# creational_code_generator_internal_program_flow_01.hpp

- Source document: [creational_code_generator_internal.hpp.md](../creational_code_generator_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Promises this file makes"]
    N2["Enter lower()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave lower()"]
    N6["Enter trim()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave trim()"]
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
    N4["Enter starts_with()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave starts_with()"]
    N8["Enter find_matching_brace()"]
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
    N1["Leave find_matching_brace()"]
    N2["Enter is_class_block()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave is_class_block()"]
    N6["Enter is_function_block()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave is_function_block()"]
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
    N0["Enter class_name_from_signature()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave class_name_from_signature()"]
    N4["Enter function_name_from_signature()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave function_name_from_signature()"]
    N8["Enter inject_singleton_accessor()"]
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
    N1["Leave inject_singleton_accessor()"]
    N2["Enter rewrite_class_instantiations_to_singleton_references()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave rewrite_class_instantiations_to_singleton_references()"]
    N6["Enter extract_crucial_class_names()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave extract_crucial_class_names()"]
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
    N0["Enter ensure_decision()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave ensure_decision()"]
    N4["Enter add_reason_if_missing()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave add_reason_if_missing()"]
    N8["Enter split_lines()"]
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

#### Part 7
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave split_lines()"]
    N2["Enter join_lines()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave join_lines()"]
    N6["Enter is_config_method_name()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave is_config_method_name()"]
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
    N0["Enter is_monolithic_config_method_name()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave is_monolithic_config_method_name()"]
    N4["Enter is_monolithic_build_method_name()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave is_monolithic_build_method_name()"]
    N8["Enter is_build_method_name()"]
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
