# Lexical

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Lexical`
- Role: token scanning and structural event extraction before class declarations and catalog recognition

## Primary Entry
- Start with `core.cpp.md`.

## Read Order
1. `core.cpp.md`
2. `language_tokens.cpp.md`
3. `StructuralHooks/`
4. `StructureVerification/`

## Workflow File
- `core.cpp.md` explains the stage-wide lexical workflow.

## Acceptance Checks
- Lexical analysis is described as scanning and event extraction.
- Final pattern matching is deferred until class declarations are generated.
- The folder points at event validation without claiming design-pattern acceptance during class scanning.


