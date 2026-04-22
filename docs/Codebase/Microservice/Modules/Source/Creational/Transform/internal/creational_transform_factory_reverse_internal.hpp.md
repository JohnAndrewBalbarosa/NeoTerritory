# creational_transform_factory_reverse_internal.hpp

- Source: Microservice/Modules/Source/Creational/Transform/internal/creational_transform_factory_reverse_internal.hpp
- Kind: C++ header
- Lines: 182
- Role: Implements creational transform dispatch, evidence rendering, and rewrite helpers.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- SourceSpan
- AllocationExpression
- FactoryHashLedgerEntry
- FactoryCreateMapping
- FactoryClassModel
- FactoryRewriteStats
- StatementSlice
- VariableDeclarationSite
- CallsiteDeclaration
- escape_regex_literal
- find_matching_paren
- is_supported_literal

## Direct Dependencies
- cstddef
- cstdint
- string
- unordered_map
- unordered_set
- vector

## Implementation Story
This source file implements a creational transform or evidence-rendering stage. It runs after the generic parse tree has been built and focuses on turning detected structure into rewritten code or explanatory evidence views. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions.   Implements creational transform dispatch, evidence rendering, and rewrite helpers.   Runs after the generic parse tree exists so creational detection or transformation can operate on it.  The implementation surface is easiest to recognize through symbols such as SourceSpan, AllocationExpression, FactoryHashLedgerEntry, and FactoryCreateMapping.  In practice it collaborates directly with cstddef, cstdint, string, and unordered_map.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Declare SourceSpan]
    N1[Declare AllocationExpression]
    N2[Declare FactoryHashLedgerEntry]
    N3[Declare FactoryCreateMapping]
    N4[Declare FactoryClassModel]
    N5[Declare FactoryRewriteStats]
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

