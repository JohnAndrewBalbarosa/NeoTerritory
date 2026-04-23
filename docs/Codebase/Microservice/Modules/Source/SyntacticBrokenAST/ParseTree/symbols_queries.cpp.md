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

## File Outline
### Responsibility

This source file implements one internal part of the generic parse-tree engine. It contributes specialized behavior such as code generation, dependency handling, symbolization, or hash-link construction after the raw tree exists. This source file implements one of the generic middle-stage services in the C++ pipeline. It is executed after sources are loaded and before the final report and rendered outputs are written.

### Position In The Flow

Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs.

### Main Surface Area

Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting. The main surface area is easiest to track through symbols such as class_symbol_table, function_symbol_table, class_usage_table, and find_class_by_name. It collaborates directly with Internal/parse_tree_symbols_internal.hpp, string, and vector.

## File Activity
```mermaid
flowchart TD
    Start([Start])
    N0[Execute find class by hash to compute hash metadata, iterate over the active collection, and branch on runtime conditions]
    N1[Execute return targets known class to parse or tokenize input text and branch on runtime conditions]
    N2[Execute find functions by name to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N3[Execute find class usages by name to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N4[Execute find function by key to iterate over the active collection and branch on runtime conditions]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Function Walkthrough

### class_symbol_table
This routine owns one focused piece of the file's behavior. It appears near line 5.

The caller receives a computed result or status from this step.

Key operations:
- This routine is primarily structural and does not expose obvious runtime operations from static inspection.

Activity:
```mermaid
flowchart TD
    Start([class_symbol_table()])
    N0[Enter class_symbol_table()]
    N1[Apply the routine's local logic]
    N2[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```

### function_symbol_table
This routine owns one focused piece of the file's behavior. It appears near line 10.

The caller receives a computed result or status from this step.

Key operations:
- This routine is primarily structural and does not expose obvious runtime operations from static inspection.

Activity:
```mermaid
flowchart TD
    Start([function_symbol_table()])
    N0[Enter function_symbol_table()]
    N1[Apply the routine's local logic]
    N2[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```

### class_usage_table
This routine owns one focused piece of the file's behavior. It appears near line 15.

The caller receives a computed result or status from this step.

Key operations:
- This routine is primarily structural and does not expose obvious runtime operations from static inspection.

Activity:
```mermaid
flowchart TD
    Start([class_usage_table()])
    N0[Enter class_usage_table()]
    N1[Apply the routine's local logic]
    N2[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```

### find_class_by_name
This routine owns one focused piece of the file's behavior. It appears near line 20.

Inside the body, it mainly handles iterate over the active collection and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_class_by_name()])
    N0[Enter find_class_by_name()]
    N1[Iterate over the active collection]
    N2[Branch on runtime conditions]
    N3[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

### find_class_by_hash
This routine owns one focused piece of the file's behavior. It appears near line 32.

Inside the body, it mainly handles compute hash metadata, iterate over the active collection, and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- compute hash metadata
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_class_by_hash()])
    N0[Enter find_class_by_hash()]
    N1[Compute hash metadata]
    N2[Iterate over the active collection]
    N3[Branch on runtime conditions]
    N4[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

### find_function_by_name
This routine owns one focused piece of the file's behavior. It appears near line 44.

Inside the body, it mainly handles iterate over the active collection and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_function_by_name()])
    N0[Enter find_function_by_name()]
    N1[Iterate over the active collection]
    N2[Branch on runtime conditions]
    N3[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

### find_function_by_key
This routine owns one focused piece of the file's behavior. It appears near line 56.

Inside the body, it mainly handles iterate over the active collection and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_function_by_key()])
    N0[Enter find_function_by_key()]
    N1[Iterate over the active collection]
    N2[Branch on runtime conditions]
    N3[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

### find_functions_by_name
This routine owns one focused piece of the file's behavior. It appears near line 68.

Inside the body, it mainly handles assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- assemble tree or artifact structures
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_functions_by_name()])
    N0[Enter find_functions_by_name()]
    N1[Assemble tree or artifact structures]
    N2[Iterate over the active collection]
    N3[Branch on runtime conditions]
    N4[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

### find_class_usages_by_name
This routine owns one focused piece of the file's behavior. It appears near line 81.

Inside the body, it mainly handles assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- assemble tree or artifact structures
- iterate over the active collection
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([find_class_usages_by_name()])
    N0[Enter find_class_usages_by_name()]
    N1[Assemble tree or artifact structures]
    N2[Iterate over the active collection]
    N3[Branch on runtime conditions]
    N4[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

### return_targets_known_class
This routine owns one focused piece of the file's behavior. It appears near line 94.

Inside the body, it mainly handles parse or tokenize input text and branch on runtime conditions.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- parse or tokenize input text
- branch on runtime conditions

Activity:
```mermaid
flowchart TD
    Start([return_targets_known_class()])
    N0[Enter return_targets_known_class()]
    N1[Parse or tokenize input text]
    N2[Branch on runtime conditions]
    N3[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

