# Microservice

- Folder: docs/Codebase/Microservice
- Descendant source docs: 99
- Generated on: 2026-04-23

## Logic Summary
C++ executable and module tree that implement the parser, detector, transform, rendering, and report pipeline.

## Child Folders By Logic
### Application Runner
- Layer/ : Application-layer orchestration around the deeper module code.

### Module Tree
- Modules/ : Modularized C++ implementation divided into compile-time headers and source implementations.

### Validation Assets
- Test/ : Validation-oriented source corpus and test support assets.

## Documents By Logic
### Executable Entrypoints
- main.cpp.md : Thin executable entrypoint that delegates to the syntactic broken AST runner.

## Reading Hint
- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.

