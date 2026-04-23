# creational_transform_factory_reverse_internal_program_flow_02.cpp

- Source document: [creational_transform_factory_reverse_internal.hpp.md](../creational_transform_factory_reverse_internal.hpp.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 9
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave literal_from_condition()"]
    N2["Enter statement_after_condition()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave statement_after_condition()"]
    N6["Enter collect_if_branch_mapping()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave collect_if_branch_mapping()"]
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
    N0["Enter collect_switch_branch_mapping()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave collect_switch_branch_mapping()"]
    N4["Enter collect_top_level_default_return()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave collect_top_level_default_return()"]
    N8["Enter parse_create_mapping_from_class_body()"]
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
    N1["Leave parse_create_mapping_from_class_body()"]
    N2["Enter collect_factory_classes()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave collect_factory_classes()"]
    N6["Enter parse_allocation_expression()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave parse_allocation_expression()"]
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
    N0["Enter is_auto_declaration_type()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave is_auto_declaration_type()"]
    N4["Enter rewrite_declaration_type()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave rewrite_declaration_type()"]
    N8["Enter resolve_variable_declaration_site()"]
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
    N1["Leave resolve_variable_declaration_site()"]
    N2["Enter parse_factory_callsite_line()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave parse_factory_callsite_line()"]
    N6["Enter build_rewritten_callsite_line()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave build_rewritten_callsite_line()"]
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

#### Part 14
```mermaid
flowchart TD
    N0["Enter build_rewritten_assignment_line()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave build_rewritten_assignment_line()"]
    N4["Enter rewrite_variable_declaration_line()"]
    N5["Declare call"]
    N6["Defer body"]
    N7["Leave rewrite_variable_declaration_line()"]
    N8["Enter remove_unused_factory_instance_declaration()"]
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

#### Part 15
```mermaid
flowchart TD
    N0["Defer body"]
    N1["Leave remove_unused_factory_instance_declaration()"]
    N2["Enter locate_class_span_by_name()"]
    N3["Declare call"]
    N4["Defer body"]
    N5["Leave locate_class_span_by_name()"]
    N6["Enter has_class_reference_outside_span()"]
    N7["Declare call"]
    N8["Defer body"]
    N9["Leave has_class_reference_outside_span()"]
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

#### Part 16
```mermaid
flowchart TD
    N0["Enter erase_span_with_trailing_newlines()"]
    N1["Declare call"]
    N2["Defer body"]
    N3["Leave erase_span_with_trailing_newlines()"]
    N4["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```
