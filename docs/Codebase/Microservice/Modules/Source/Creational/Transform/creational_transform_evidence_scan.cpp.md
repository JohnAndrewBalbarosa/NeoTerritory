# creational_transform_evidence_scan.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_scan.cpp
- Kind: C++ implementation
- Lines: 264
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- scan_pattern_evidence
- singleton_accessor_regex
- singleton_call_regex
- builder_class_regex
- builder_step_regex
- build_method_regex
- before_callsite_regex
- after_callsite_regex
- member_call_regex
- config_chain_regex
- static_decl_for_class
- return_identifier_regex

## Direct Dependencies
- internal/creational_transform_evidence_internal.hpp
- regex
- unordered_set
- utility

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as scan_pattern_evidence, singleton_accessor_regex, singleton_call_regex, and builder_class_regex.  In practice it collaborates directly with internal/creational_transform_evidence_internal.hpp, regex, unordered_set, and utility.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute scan pattern evidence to parse or tokenize input text, assemble tree or artifact structures, and iterate over the active collection]
    N1[Execute if to assemble tree or artifact structures]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

