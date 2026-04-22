# builder_pattern_logic.cpp

- Source: Microservice/Modules/Source/Creational/Builder/builder_pattern_logic.cpp
- Kind: C++ implementation
- Lines: 282
- Role: Implements creational pattern detection over the generic parse tree.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- trim
- split_words
- lower
- lowercase_ascii
- starts_with
- is_class_block
- is_function_block
- class_name
- function_name
- has_builder_assignments
- returns_self_type
- is_build_step_method

## Direct Dependencies
- Builder/builder_pattern_logic.hpp
- language_tokens.hpp
- cctype
- string
- utility
- vector

## Implementation Story
This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions. Implements creational pattern detection over the generic parse tree. Runs after the generic parse tree exists so creational detection or transformation can operate on it. The implementation surface is easiest to recognize through symbols such as trim, split_words, lower, and lowercase_ascii. In practice it collaborates directly with Builder/builder_pattern_logic.hpp, language_tokens.hpp, cctype, and string.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute trim to iterate over the active collection]
    N1[Execute split words to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N2[Execute if to assemble tree or artifact structures]
    N3[Execute lower]
    N4[Execute starts with]
    N5[Execute is class block to branch on runtime conditions]
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

