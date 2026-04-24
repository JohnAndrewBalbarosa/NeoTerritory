# Lexical

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Lexical`
- Role: token scanning, structural event extraction, and strict expected-structure verification during class scanning

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
- Lexical analysis is described as both scanning and verification.
- Structural verification is shown as part of the lexical stage.
- The folder points at explicit verification logic instead of hiding it inside generic hook wording.


