# builder_pattern_logic.hpp

- Source: Microservice/Modules/Header/Creational/Builder/builder_pattern_logic.hpp
- Kind: C++ header
- Lines: 41
- Role: Declares creational-pattern detection and transform interfaces.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- BuilderMethodStructureCheck
- BuilderStructureCheckResult
- check_builder_pattern_structure
- assignments
- build_builder_pattern_tree

## Direct Dependencies
- creational_broken_tree.hpp
- parse_tree.hpp
- cstddef
- string
- vector

## Implementation Story
This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define. Declares creational-pattern detection and transform interfaces. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as BuilderMethodStructureCheck, BuilderStructureCheckResult, check_builder_pattern_structure, and assignments. In practice it collaborates directly with creational_broken_tree.hpp, parse_tree.hpp, cstddef, and string.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare BuilderMethodStructureCheck]
    N1[Declare BuilderStructureCheckResult]
    N2[Declare check_builder_pattern_structure]
    N3[Declare assignments]
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

