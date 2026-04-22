# parse_tree_symbols.hpp

- Source: Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/parse_tree_symbols.hpp
- Kind: C++ header
- Lines: 96
- Role: Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- Chronology: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

## Notable Symbols
- ParseSymbol
- ParseSymbolUsage
- ParseTreeSymbolBuildOptions
- ParseTreeSymbolTables
- build_parse_tree_symbol_tables
- class_symbol_table
- function_symbol_table
- class_usage_table
- find_class_by_name
- find_class_by_hash
- find_function_by_name
- find_function_by_key

## Direct Dependencies
- parse_tree.hpp
- cstddef
- string
- unordered_set
- vector

## Implementation Story
This header implements the compile-time contract for the generic parse and analysis pipeline. It is included before runtime execution begins so the C++ sources can agree on the shared data structures and function signatures. Declares the public interfaces and shared data types for the generic parse and analysis pipeline. This artifact participates in the repository flow according to the surrounding module or toolchain that loads it. The implementation surface is easiest to recognize through symbols such as ParseSymbol, ParseSymbolUsage, ParseTreeSymbolBuildOptions, and ParseTreeSymbolTables. In practice it collaborates directly with parse_tree.hpp, cstddef, string, and unordered_set.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare ParseSymbol]
    N1[Declare ParseSymbolUsage]
    N2[Declare ParseTreeSymbolBuildOptions]
    N3[Declare ParseTreeSymbolTables]
    N4[Declare class_symbol_table]
    N5[Declare function_symbol_table]
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

