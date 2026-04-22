# symbols_queries.cpp

- Source: Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/symbols_queries.cpp
- Kind: C++ implementation
- Lines: 105
- Role: Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.
- Chronology: Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs.

## Notable Symbols
- class_symbol_table
- function_symbol_table
- class_usage_table
- find_class_by_name
- find_class_by_hash
- find_function_by_name
- find_function_by_key
- find_functions_by_name
- find_class_usages_by_name
- return_targets_known_class

## Direct Dependencies
- Internal/parse_tree_symbols_internal.hpp
- string
- vector

## Implementation Story
This source file implements one internal part of the generic parse-tree engine. It contributes specialized behavior such as code generation, dependency handling, symbolization, or hash-link construction after the raw tree exists. This source file implements one of the generic middle-stage services in the C++ pipeline. It is executed after sources are loaded and before the final report and rendered outputs are written.   Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.   Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs.  The implementation surface is easiest to recognize through symbols such as class_symbol_table, function_symbol_table, class_usage_table, and find_class_by_name.  In practice it collaborates directly with Internal/parse_tree_symbols_internal.hpp, string, and vector.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute class symbol table]
    N1[Execute function symbol table]
    N2[Execute class usage table]
    N3[Execute find class by name to iterate over the active collection and branch on runtime conditions]
    N4[Execute find class by hash to compute hash metadata, iterate over the active collection, and branch on runtime conditions]
    N5[Execute find function by name to iterate over the active collection and branch on runtime conditions]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

