# creational_transform_factory_reverse_parse.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_factory_reverse_parse.cpp
- Kind: C++ implementation
- Lines: 165
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- parse_create_mapping_from_class_body
- collect_factory_classes
- class_regex

## Direct Dependencies
- internal/creational_transform_factory_reverse_internal.hpp
- Transform/creational_code_generator_internal.hpp
- cctype
- regex
- string
- vector

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as parse_create_mapping_from_class_body, collect_factory_classes, and class_regex.  In practice it collaborates directly with internal/creational_transform_factory_reverse_internal.hpp, Transform/creational_code_generator_internal.hpp, cctype, and regex.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute collect factory classes to parse or tokenize input text, assemble tree or artifact structures, and iterate over the active collection]
    N1[Execute parse create mapping from class body]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

