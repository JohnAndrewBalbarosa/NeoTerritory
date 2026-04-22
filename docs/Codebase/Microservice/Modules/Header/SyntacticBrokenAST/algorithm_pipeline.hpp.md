# algorithm_pipeline.hpp

- Source: Microservice/Modules/Header/SyntacticBrokenAST/algorithm_pipeline.hpp
- Kind: C++ header
- Lines: 73
- Role: Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- StageMetric
- PipelineReport
- PipelineArtifacts
- run_normalize_and_rewrite_pipeline
- pipeline_report_to_json

## Direct Dependencies
- behavioural_broken_tree.hpp
- creational_broken_tree.hpp
- parse_tree.hpp
- parse_tree_code_generator.hpp
- parse_tree_hash_links.hpp
- parse_tree_symbols.hpp
- source_reader.hpp
- cstddef
- string
- vector

## Implementation Story
This header implements the compile-time contract for the generic parse and analysis pipeline. It is included before runtime execution begins so the C++ sources can agree on the shared data structures and function signatures. Declares the public interfaces and shared data types for the generic parse and analysis pipeline. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as StageMetric, PipelineReport, PipelineArtifacts, and run_normalize_and_rewrite_pipeline. In practice it collaborates directly with behavioural_broken_tree.hpp, creational_broken_tree.hpp, parse_tree.hpp, and parse_tree_code_generator.hpp.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare StageMetric]
    N1[Declare PipelineReport]
    N2[Declare PipelineArtifacts]
    N3[Declare run_normalize_and_rewrite_pipeline]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

