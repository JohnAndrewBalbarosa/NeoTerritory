# factory_pattern_logic.cpp

- Source: Microservice/Modules/Source/Creational/Factory/factory_pattern_logic.cpp
- Kind: C++ implementation
- Lines: 575
- Role: Implements creational pattern detection over the generic parse tree.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- trim
- to_lower
- lowercase_ascii
- split_words
- starts_with
- class_name_from_signature
- function_name_from_signature
- is_class_block
- is_function_block
- is_conditional_block
- extract_return_expr
- extract_type_in_angle_brackets

## Direct Dependencies
- Factory/factory_pattern_logic.hpp
- language_tokens.hpp
- parse_tree_symbols.hpp
- cctype
- string
- unordered_map
- vector

## Implementation Story
This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions. Implements creational pattern detection over the generic parse tree. Runs after the generic parse tree exists so creational detection or transformation can operate on it. The implementation surface is easiest to recognize through symbols such as trim, to_lower, lowercase_ascii, and split_words. In practice it collaborates directly with Factory/factory_pattern_logic.hpp, language_tokens.hpp, parse_tree_symbols.hpp, and cctype.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute trim to iterate over the active collection]
    N1[Execute to lower]
    N2[Execute split words to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N3[Execute if to assemble tree or artifact structures]
    N4[Execute starts with]
    N5[Execute class name from signature to iterate over the active collection and branch on runtime conditions]
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

