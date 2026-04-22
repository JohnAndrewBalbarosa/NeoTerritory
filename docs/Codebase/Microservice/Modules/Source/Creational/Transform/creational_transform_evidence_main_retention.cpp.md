# creational_transform_evidence_main_retention.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_main_retention.cpp
- Kind: C++ implementation
- Lines: 147
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- MainOccurrence
- brace_delta
- retain_single_main_function
- main_signature_regex
- file_marker_regex
- join_lines

## Direct Dependencies
- internal/creational_transform_evidence_internal.hpp
- regex

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as MainOccurrence, brace_delta, retain_single_main_function, and main_signature_regex.  In practice it collaborates directly with internal/creational_transform_evidence_internal.hpp and regex.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute brace delta to iterate over the active collection and branch on runtime conditions]
    N1[Execute retain single main function]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

