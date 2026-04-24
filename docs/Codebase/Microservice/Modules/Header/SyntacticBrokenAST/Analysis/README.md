# Analysis

- Folder: `docs/Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Analysis`
- Role: contracts for source intake, lexical scanning, implementation-use binding, and pattern interpretation

## Read Order
1. `Input/`
2. `Lexical/`
3. `ImplementationUse/`
4. `Patterns/`

## Boundary
- Keep declarations under the same algorithm stage as the source-side ownership.
- Do not split these contracts back into outer `Behavioural/` or `Creational/` roots.
