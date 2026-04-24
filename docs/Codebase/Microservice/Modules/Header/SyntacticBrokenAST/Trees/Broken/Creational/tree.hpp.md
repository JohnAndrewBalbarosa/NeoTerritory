# creational_broken_tree.hpp

- Source: Microservice/Modules/Header/Creational/creational_broken_tree.hpp
- Kind: C++ header

## Story
### What Happens Here

This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define.

### Why It Matters In The Flow

This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

### What To Watch While Reading

Declares creational-pattern detection and transform interfaces. The main surface area is easiest to track through symbols such as CreationalTreeNode, ICreationalDetector, ICreationalTreeCreator, and detect. It collaborates directly with parse_tree.hpp, string, and vector.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow](./creational_broken_tree/creational_broken_tree_program_flow.hpp.md)
## Reading Map
Read this file as: Declares creational-pattern detection and transform interfaces.

Where it sits in the run: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

Names worth recognizing while reading: CreationalTreeNode, ICreationalDetector, ICreationalTreeCreator, detect, create, and build_creational_broken_tree.

It leans on nearby contracts or tools such as parse_tree.hpp, string, and vector.

## Story Groups

### Promises This File Makes
These entries tell the rest of the program what this file can provide.
- CreationalTreeNode: Declare a shared type and expose the compile-time contract
- ICreationalDetector: Declare a shared type and expose the compile-time contract
- ICreationalTreeCreator: Declare a shared type and expose the compile-time contract
- build_creational_broken_tree(): Declare a callable contract and let implementation files define the runtime body
- creational_tree_to_parse_tree_node(): Declare a callable contract and let implementation files define the runtime body
- creational_tree_to_html(): Declare a callable contract and let implementation files define the runtime body
- creational_tree_to_text(): Declare a callable contract and let implementation files define the runtime body

## Function Stories
Function-level logic is decoupled into future implementation units:

- [creationaltreenode](./creational_broken_tree/functions/creationaltreenode.hpp.md)
- [icreationaldetector](./creational_broken_tree/functions/icreationaldetector.hpp.md)
- [icreationaltreecreator](./creational_broken_tree/functions/icreationaltreecreator.hpp.md)
- [build_creational_broken_tree](./creational_broken_tree/functions/build_creational_broken_tree.hpp.md)
- [creational_tree_to_parse_tree_node](./creational_broken_tree/functions/creational_tree_to_parse_tree_node.hpp.md)
- [creational_tree_to_html](./creational_broken_tree/functions/creational_tree_to_html.hpp.md)
- [creational_tree_to_text](./creational_broken_tree/functions/creational_tree_to_text.hpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.