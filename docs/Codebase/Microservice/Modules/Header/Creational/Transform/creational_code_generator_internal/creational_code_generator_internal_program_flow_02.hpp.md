# creational_code_generator_internal_program_flow_02.hpp

- Source document: [creational_code_generator_internal.hpp.md](../creational_code_generator_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 9
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave is_build_method_name()"]
    N2["Enter is_operational_method_name()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave is_operational_method_name()"]
    N6["Enter ends_with()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave ends_with()"]
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
    N0["Enter strip_builder_suffix()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave strip_builder_suffix()"]
    N4["Enter append_unique_token()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave append_unique_token()"]
    N8["Enter append_unique_line()"]
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

#### Part 11
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave append_unique_line()"]
    N2["Enter append_unique_lines()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave append_unique_lines()"]
    N6["Enter regex_capture_or_empty()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave regex_capture_or_empty()"]
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

#### Part 12
```mermaid
flowchart TD
    N0["Enter build_monolithic_evidence_view()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave build_monolithic_evidence_view()"]
    N4["Enter transform_to_singleton_by_class_references()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave transform_to_singleton_by_class_references()"]
    N8["Enter transform_singleton_to_builder()"]
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

#### Part 13
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave transform_singleton_to_builder()"]
    N2["Enter transform_using_registered_rule()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave transform_using_registered_rule()"]
    N6["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
```
