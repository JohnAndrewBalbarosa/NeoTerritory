# creational_code_generator_internal.hpp

- Source: Microservice/Modules/Header/Creational/Transform/creational_code_generator_internal.hpp
- Kind: C++ header
- Lines: 85
- Role: Declares creational-pattern detection and transform interfaces.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- lower
- trim
- split_words
- starts_with
- find_matching_brace
- is_class_block
- is_function_block
- class_name_from_signature
- function_name_from_signature
- inject_singleton_accessor
- rewrite_class_instantiations_to_singleton_references
- extract_crucial_class_names

## Direct Dependencies
- parse_tree.hpp
- parse_tree_code_generator.hpp
- Singleton/singleton_pattern_logic.hpp
- cstddef
- regex
- string
- unordered_map
- vector

## Implementation Story
This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define. Declares creational-pattern detection and transform interfaces. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as lower, trim, split_words, and starts_with. In practice it collaborates directly with parse_tree.hpp, parse_tree_code_generator.hpp, Singleton/singleton_pattern_logic.hpp, and cstddef.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare lower]
    N1[Declare trim]
    N2[Declare split_words]
    N3[Declare starts_with]
    N4[Declare find_matching_brace]
    N5[Declare is_class_block]
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

