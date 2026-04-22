# creational_transform_rules.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_rules.cpp
- Kind: C++ implementation
- Lines: 543
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- ConfigMethodModel
- ClassBuilderModel
- TransformRule
- derive_field_base_name
- collect_config_methods_for_class
- generate_builder_class_code
- inject_builder_class
- rewrite_simple_singleton_callsite_to_builder
- decl_regex
- method_call_regex
- transform_to_singleton_by_class_references
- transform_factory_to_base

## Direct Dependencies
- Transform/creational_code_generator_internal.hpp
- Transform/creational_transform_factory_reverse.hpp
- parse_tree_symbols.hpp
- cctype
- regex
- sstream
- string
- unordered_map
- unordered_set
- utility
- vector

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as ConfigMethodModel, ClassBuilderModel, TransformRule, and derive_field_base_name.  In practice it collaborates directly with Transform/creational_code_generator_internal.hpp, Transform/creational_transform_factory_reverse.hpp, parse_tree_symbols.hpp, and cctype.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute derive field base name to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N1[Execute collect config methods for class to parse or tokenize input text, assemble tree or artifact structures, and iterate over the active collection]
    N2[Execute generate builder class code to serialize report content, iterate over the active collection, and branch on runtime conditions]
    N3[Execute inject builder class to parse or tokenize input text, assemble tree or artifact structures, and serialize report content]
    N4[Execute rewrite simple singleton callsite to builder to parse or tokenize input text, assemble tree or artifact structures, and serialize report content]
    N5[Execute transform to singleton by class references to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
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

