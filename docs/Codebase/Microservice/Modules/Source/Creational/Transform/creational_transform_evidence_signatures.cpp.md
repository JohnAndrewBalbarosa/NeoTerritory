# creational_transform_evidence_signatures.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_signatures.cpp
- Kind: C++ implementation
- Lines: 77
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- collect_class_signature_lines
- wanted
- class_decl_regex
- collect_method_signature_lines

## Direct Dependencies
- internal/creational_transform_evidence_internal.hpp
- regex
- unordered_set

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as collect_class_signature_lines, wanted, class_decl_regex, and collect_method_signature_lines.  In practice it collaborates directly with internal/creational_transform_evidence_internal.hpp, regex, and unordered_set.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute collect method signature lines to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    N1[Execute collect class signature lines to assemble tree or artifact structures, iterate over the active collection, and branch on runtime conditions]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

