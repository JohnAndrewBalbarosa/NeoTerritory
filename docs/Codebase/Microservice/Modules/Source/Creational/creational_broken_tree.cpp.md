# creational_broken_tree.cpp

- Source: Microservice/Modules/Source/Creational/creational_broken_tree.cpp
- Kind: C++ implementation
- Lines: 143
- Role: Implements creational pattern detection over the generic parse tree.
- Chronology: Runs after the generic parse tree exists so creational detection or transformation can operate on it.

## Notable Symbols
- FactoryPatternDetector
- SingletonPatternDetector
- BuilderPatternDetector
- DefaultCreationalTreeCreator
- detect
- build_factory_pattern_tree
- build_singleton_pattern_tree
- build_builder_pattern_tree
- create
- build_creational_broken_tree
- creational_tree_to_parse_tree_node
- creational_tree_to_html

## Direct Dependencies
- creational_broken_tree.hpp
- Builder/builder_pattern_logic.hpp
- Factory/factory_pattern_logic.hpp
- Singleton/singleton_pattern_logic.hpp
- tree_html_renderer.hpp
- functional
- sstream
- string
- utility
- vector

## Implementation Story
This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or transform decisions. Implements creational pattern detection over the generic parse tree. Runs after the generic parse tree exists so creational detection or transformation can operate on it. The implementation surface is easiest to recognize through symbols such as FactoryPatternDetector, SingletonPatternDetector, BuilderPatternDetector, and DefaultCreationalTreeCreator. In practice it collaborates directly with creational_broken_tree.hpp, Builder/builder_pattern_logic.hpp, Factory/factory_pattern_logic.hpp, and Singleton/singleton_pattern_logic.hpp.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Execute build creational broken tree to assemble tree or artifact structures]
    N1[Execute creational tree to parse tree node to parse or tokenize input text, assemble tree or artifact structures, and iterate over the active collection]
    N2[Execute creational tree to html to parse or tokenize input text and render text or HTML views]
    N3[Execute creational tree to text to assemble tree or artifact structures, serialize report content, and iterate over the active collection]
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

