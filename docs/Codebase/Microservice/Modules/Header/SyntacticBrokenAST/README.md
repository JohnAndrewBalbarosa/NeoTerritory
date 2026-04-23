# SyntacticBrokenAST

- Folder: docs/Codebase/Microservice/Modules/Header/SyntacticBrokenAST
- Descendant source docs: 23
- Generated on: 2026-04-23

## Logic Summary
Generic parser and analysis interfaces shared across the microservice.

## Child Folders By Logic
### Input And CLI Contracts
- Input-and-CLI/ : Contracts that describe how source files enter the syntactic subsystem and how command input is represented.

### Internal Contracts
- Internal/ : Internal header contracts supporting the syntactic subsystem.

### Language And Structure Contracts
- Language-and-Structure/ : Contracts for token vocabulary and structural keyword hooks used during parsing.

### Output And Rendering Contracts
- Output-and-Rendering/ : Contracts for output writing and visual rendering of generated syntactic artifacts.

### ParseTree Contracts
- ParseTree/ : Public parse-tree contracts and helper interfaces.

### Pipeline Contracts
- Pipeline-Contracts/ : Pipeline-level contracts for reports, shared context, and orchestration-facing syntactic types.

## Documents By Logic
### Syntactic Interfaces
- parse_tree.hpp.md : Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- parse_tree_code_generator.hpp.md : Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- parse_tree_dependency_utils.hpp.md : Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- parse_tree_hash_links.hpp.md : Declares the public interfaces and shared data types for the generic parse and analysis pipeline.
- parse_tree_symbols.hpp.md : Declares the public interfaces and shared data types for the generic parse and analysis pipeline.

## Reading Hint
- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.

