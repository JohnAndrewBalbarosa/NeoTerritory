# source_reader.cpp

- Source: Microservice/Modules/Source/SyntacticBrokenAST/source_reader.cpp
- Kind: C++ implementation
- Lines: 51
- Role: Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.
- Chronology: Runs early in the microservice flow to load raw file contents before parsing begins.

## Notable Symbols
- read_source_file_units
- file
- join_source_file_units

## Direct Dependencies
- source_reader.hpp
- fstream
- iostream
- sstream

## Implementation Story
This file implements the source-ingestion step for the C++ pipeline. It opens each discovered file, reads the contents into SourceFileUnit records, and can also flatten the set into a monolithic source string for later evidence rendering. This source file implements one of the generic middle-stage services in the C++ pipeline. It is executed after sources are loaded and before the final report and rendered outputs are written.   Implements parsing, shadow-tree building, symbolization, hash linking, rendering, and reporting.   Runs early in the microservice flow to load raw file contents before parsing begins.  The implementation surface is easiest to recognize through symbols such as read_source_file_units, file, and join_source_file_units.  In practice it collaborates directly with source_reader.hpp, fstream, iostream, and sstream.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute read source file units to read source or input files, assemble tree or artifact structures, and serialize report content]
    N1[Execute join source file units to serialize report content, iterate over the active collection, and branch on runtime conditions]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

