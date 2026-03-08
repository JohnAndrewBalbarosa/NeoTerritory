# AST Pipeline Step Map

## Scope

This map documents the implemented pipeline behavior and ownership boundaries.

## Ownership Boundary (Implemented)

- `SyntacticBrokenAST` owns generic parsing, AST construction, hash links, symbol indexing, and pipeline/report orchestration.
- `Creational` owns creational detection and creational code transforms/evidence rendering.
- `Behavioural` owns behavioural detection and behavioural structural hook keyword providers.

`SyntacticBrokenAST` now delegates pattern-specific logic instead of implementing pattern transforms directly.

## A1. CLI + Context Entry

- CLI captures source/target pattern and input folder files.
- Parse context is passed into lexical parsing and downstream pipeline stages.

## A2. Root + File Separation

- Parse root: `TranslationUnit("Root")`
- Immediate children: per-file `FileUnit`

## A3. Dual Tree Build

- `main_tree`: full parse graph
- `shadow_tree`: relevance-filtered virtual graph

## A4. Class Registration + Line Hash Traces

During lexical parse:

- class name hash and file-aware class context hash are registered
- line traces capture `matched_class_contextual_hash`, `outgoing_hash`, `hash_chain`, and collision markers

## A5. Scope Propagation Hashing

- Child contextual hashes derive from parent hash + node identity + sibling index
- Usage hashes are propagated within lexical scope and copied into parse nodes

## A6. File Bucketization

Each file node is bucketized for traversal:

- `ClassDeclarations`
- `GlobalFunctionDeclarations`

Applied to both actual and virtual trees.

## A7. Symbol Tables + Overload-safe Function Keys

Function identity key includes:

- file path
- owner scope
- function name
- parameter hint

This prevents same-name overload collisions across files/scopes.

## A8. Hash Link Stage (Paired File View)

Hash-link stage emits paired traversal context:

- `Root -> FileUnit -> ActualParseTree`
- `Root -> FileUnit -> VirtualParseTree`

Bidirectional link indexing includes:

- class anchors (class hash + contextual hash)
- usage anchors (outgoing/hash_chain + propagated usage hashes)

Collision disambiguation contract:

1. class-name hash candidates
2. parent ancestry expansion
3. file basename
4. full file path
5. node index path tie-break

## A9. Report Serialization

Report includes:

- class registry links for actual/virtual trees
- line hash trace links for class anchors and usage anchors
- ancestry metadata:
  - `readable_ancestry`
  - `hash_ancestry`
- link status fields:
  - `unique | multi_match | unresolved`
- transform decision projection per class:
  - `transform_applied`
  - `transform_reason[]`

## Delegation Flow (Current)

- `generate_target_code_from_source(...)` in Syntactic delegates transform execution to Creational transform pipeline.
- `generate_base_code_from_source(...)` and target rendering delegate evidence rendering to Creational.
  - `singleton -> builder` uses monolithic evidence sections/skeletons.
  - other routes (including `* -> singleton`) use passthrough generated code view with single-main retention.
- Lexical structural hooks in Syntactic resolve keywords via Creational and Behavioural providers.
