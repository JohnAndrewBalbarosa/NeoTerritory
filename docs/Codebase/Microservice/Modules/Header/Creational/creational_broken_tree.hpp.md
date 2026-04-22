# creational_broken_tree.hpp

- Source: Microservice/Modules/Header/Creational/creational_broken_tree.hpp
- Kind: C++ header
- Lines: 50
- Role: Declares creational-pattern detection and transform interfaces.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- CreationalTreeNode
- ICreationalDetector
- ICreationalTreeCreator
- detect
- create
- build_creational_broken_tree
- creational_tree_to_parse_tree_node
- creational_tree_to_html
- creational_tree_to_text

## Direct Dependencies
- parse_tree.hpp
- string
- vector

## Implementation Story
This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define. Declares creational-pattern detection and transform interfaces. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as CreationalTreeNode, ICreationalDetector, ICreationalTreeCreator, and detect. In practice it collaborates directly with parse_tree.hpp, string, and vector.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare CreationalTreeNode]
    N1[Declare ICreationalDetector]
    N2[Declare ICreationalTreeCreator]
    N3[Declare build_creational_broken_tree]
    N4[Declare creational_tree_to_parse_tree_node]
    N5[Declare creational_tree_to_html]
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

