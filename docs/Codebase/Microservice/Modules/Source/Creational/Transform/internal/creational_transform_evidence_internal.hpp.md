# creational_transform_evidence_internal.hpp

- Source: Microservice/Modules/Source/Creational/Transform/internal/creational_transform_evidence_internal.hpp
- Kind: C++ header
- Lines: 96
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- SingletonCallsiteEvidence
- EvidenceScanResult
- MonolithicClassView
- collect_class_signature_lines
- collect_method_signature_lines
- brace_delta
- retain_single_main_function
- scan_pattern_evidence
- ensure_class_view
- method_name_from_chain_call
- build_class_views
- build_source_evidence_present_lines

## Direct Dependencies
- Transform/creational_code_generator_internal.hpp
- sstream
- string
- vector

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as SingletonCallsiteEvidence, EvidenceScanResult, MonolithicClassView, and collect_class_signature_lines.  In practice it collaborates directly with Transform/creational_code_generator_internal.hpp, sstream, string, and vector.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare SingletonCallsiteEvidence]
    N1[Declare EvidenceScanResult]
    N2[Declare MonolithicClassView]
    N3[Declare collect_class_signature_lines]
    N4[Declare collect_method_signature_lines]
    N5[Declare brace_delta]
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

