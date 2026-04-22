# creational_transform_factory_reverse_rewrite.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_factory_reverse_rewrite.cpp
- Kind: C++ implementation
- Lines: 508
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- match_instance_declaration_for_class
- declaration_regex
- match_simple_variable_declaration
- parse_allocation_expression
- make_unique_regex
- make_shared_regex
- raw_new_regex
- is_auto_declaration_type
- auto_regex
- std::regex_match
- rewrite_declaration_type
- unique_ptr_regex

## Direct Dependencies
- internal/creational_transform_factory_reverse_internal.hpp
- Transform/creational_code_generator_internal.hpp
- regex
- string

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as match_instance_declaration_for_class, declaration_regex, match_simple_variable_declaration, and parse_allocation_expression.  In practice it collaborates directly with internal/creational_transform_factory_reverse_internal.hpp, Transform/creational_code_generator_internal.hpp, regex, and string.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute match instance declaration for class to branch on runtime conditions]
    N1[Execute match simple variable declaration to branch on runtime conditions]
    N2[Execute parse allocation expression to branch on runtime conditions]
    N3[Execute is auto declaration type]
    N4[Execute rewrite declaration type to branch on runtime conditions]
    N5[Execute resolve variable declaration site to iterate over the active collection and branch on runtime conditions]
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

