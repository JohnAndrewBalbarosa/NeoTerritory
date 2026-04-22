# code_generator.cpp

- Source: Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/code_generator.cpp
- Kind: C++ implementation
- Lines: 46
- Role: Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.
- Chronology: Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs.

## Notable Symbols
- get_last_transform_decisions
- generate_base_code_from_source
- render_creational_evidence_view
- generate_target_code_from_source

## Direct Dependencies
- parse_tree_code_generator.hpp
- Transform/creational_transform_pipeline.hpp

## Implementation Story
This source file implements one internal part of the generic parse-tree engine. It contributes specialized behavior such as code generation, dependency handling, symbolization, or hash-link construction after the raw tree exists. This source file implements one of the generic middle-stage services in the C++ pipeline. It is executed after sources are loaded and before the final report and rendered outputs are written.   Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.   Runs across the middle of the microservice flow to build parse trees, hash links, symbol tables, reports, and rendered outputs.  The implementation surface is easiest to recognize through symbols such as get_last_transform_decisions, generate_base_code_from_source, render_creational_evidence_view, and generate_target_code_from_source.  In practice it collaborates directly with parse_tree_code_generator.hpp and Transform/creational_transform_pipeline.hpp.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute get last transform decisions]
    N1[Execute generate base code from source to generate code or evidence output]
    N2[Execute generate target code from source to render text or HTML views]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

