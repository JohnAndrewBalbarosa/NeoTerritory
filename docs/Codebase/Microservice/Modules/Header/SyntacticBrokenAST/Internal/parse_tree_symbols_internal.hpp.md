# parse_tree_symbols_internal.hpp

- Source: Microservice/Modules/Header/SyntacticBrokenAST/Internal/parse_tree_symbols_internal.hpp
- Kind: C++ header
- Lines: 36
- Role: Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- trim
- starts_with
- split_words
- class_name_from_signature
- function_name_from_signature
- function_parameter_hint_from_signature
- build_function_key
- is_main_function_name
- is_class_block
- is_function_block
- is_candidate_usage_node
- extract_return_candidate_name

## Direct Dependencies
- parse_tree_symbols.hpp
- string
- vector

## Implementation Story
This header implements the compile-time contract for the generic parse and analysis pipeline. It is included before runtime execution begins so the C++ sources can agree on the shared data structures and function signatures. Declares the public interfaces and shared data types for the generic parse and analysis pipeline. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as trim, starts_with, split_words, and class_name_from_signature. In practice it collaborates directly with parse_tree_symbols.hpp, string, and vector.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare trim]
    N1[Declare starts_with]
    N2[Declare split_words]
    N3[Declare class_name_from_signature]
    N4[Declare function_name_from_signature]
    N5[Declare function_parameter_hint_from_signature]
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

