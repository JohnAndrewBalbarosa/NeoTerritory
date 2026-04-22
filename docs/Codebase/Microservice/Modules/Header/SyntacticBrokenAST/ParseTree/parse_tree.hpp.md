# parse_tree.hpp

- Source: Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/parse_tree.hpp
- Kind: C++ header
- Lines: 82
- Role: Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- ParseTreeNode
- LineHashTrace
- FactoryInvocationTrace
- ParseTreeBundle
- build_cpp_parse_tree
- build_cpp_parse_trees
- parse_tree_to_text
- parse_tree_to_html

## Direct Dependencies
- analysis_context.hpp
- lexical_structure_hooks.hpp
- source_reader.hpp
- cstddef
- string
- vector

## Implementation Story
This header implements the compile-time contract for the generic parse and analysis pipeline. It is included before runtime execution begins so the C++ sources can agree on the shared data structures and function signatures. Declares the public interfaces and shared data types for the generic parse and analysis pipeline. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as ParseTreeNode, LineHashTrace, FactoryInvocationTrace, and ParseTreeBundle. In practice it collaborates directly with analysis_context.hpp, lexical_structure_hooks.hpp, source_reader.hpp, and cstddef.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare ParseTreeNode]
    N1[Declare LineHashTrace]
    N2[Declare FactoryInvocationTrace]
    N3[Declare ParseTreeBundle]
    N4[Declare build_cpp_parse_trees]
    N5[Declare parse_tree_to_text]
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

