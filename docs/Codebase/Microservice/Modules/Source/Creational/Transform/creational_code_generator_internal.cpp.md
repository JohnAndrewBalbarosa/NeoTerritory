# creational_code_generator_internal.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_code_generator_internal.cpp
- Kind: C++ implementation
- Lines: 494
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- lower
- lowercase_ascii
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

## Direct Dependencies
- Transform/creational_code_generator_internal.hpp
- language_tokens.hpp
- cctype
- regex
- sstream
- string
- unordered_map
- unordered_set
- vector

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as lower, lowercase_ascii, trim, and split_words.  In practice it collaborates directly with Transform/creational_code_generator_internal.hpp, language_tokens.hpp, cctype, and regex.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute lower]
    N1[Execute trim to iterate over the active collection]
    N2[Execute split words to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N3[Execute if to assemble tree or artifact structures]
    N4[Execute starts with]
    N5[Execute find matching brace]
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

