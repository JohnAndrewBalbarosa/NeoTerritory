# Microservice Algorithm Implementation

## Architecture Summary

The system uses a loosely coupled microservice architecture:
- Node.js orchestration layer for API and workflow control
- C++ backend for deterministic parsing, detection, abstraction, and generation

The core engine is deterministic and DPDA-oriented. It avoids probabilistic inference in the core transformation path.

## Operational Lifecycle

## Phase 1: Construction and Evaluation (Parsing)

### 1. Root and Bifurcated Tree Topology

- Initialize global root node.
- Add per-source-file nodes (for example, main.cpp).
- For each file node, construct:
  - Actual Parse Node (full AST)
  - Virtual Copy (sparse candidate tree)

### 2. Separation of Concerns

Both trees keep explicit structural separation between:
- class declarations
- implementations

This boundary supports localized candidate extraction and safe stitching.

### 3. Broken AST Virtual Copy

The virtual copy is intentionally sparse and candidate-focused.
It stores only structural nodes that are potential refactoring or documentation candidates.
Non-relevant syntax and declarations are pruned to reduce memory and traversal cost.

### 4. Salted Contextual Hash Mapping (Reversed Merkle Style)

For each node, compute contextual hash from parent scope plus node identity.
Conceptually:

H(parent_scope || identifier)

Expected declaration-usage collision in same scope is treated as positive validation signal.
This resolves same-name ambiguity across different files/scopes and supports O(1) lookup behavior.

### 5. Similarity Evaluation and Dirty-Bit

Compute and store similarity signals:
- token identity and type mapping
- parent consistency
- statement membership
- value equality
- sequence similarity

Set dirty-bit on nodes that match target pattern evidence or inconsistency criteria.

## Phase 2: Detection and Abstraction (Intermediate)

### 1. Target Isolation via Hash Traversal

Traverse virtual candidate tree and collect active dirty-bit nodes.
Use hash links to recover exact locations from actual parse tree.

### 2. Intermediate Base Representation (IBR)

Convert isolated pattern-defining segments into neutral IBR.
IBR is language-agnostic enough to decouple detection and generation logic from source syntactic noise.

### 3. Pattern-Defining vs Pattern-Neutral Segmentation

For each detected pattern instance:
- Pattern-defining parts: required to preserve the pattern identity.
- Pattern-neutral parts: business logic that should remain unchanged regardless of pattern.

Generate documentation annotations for pattern-defining parts.

## Phase 3: Generation and Preservation (Refactoring)

### 1. Deterministic Generation

Use IBR to reconstruct target structures deterministically when generation mode is enabled.

### 2. Strict Preservation Rule

Only dirty-bit candidate segments are regenerated or annotated.
All other AST branches are preserved exactly to avoid side effects.

### 3. Documentation-First Output

Primary output for onboarding flow:
- what makes the pattern what it is
- which code blocks are required
- which blocks remain unchanged even without the pattern
- where comments should be inserted for documentation

## Updated Product Behavior

The default workflow is now detection and documentation, not mandatory pattern translation.

Supported modes:
- detect-only documentation mode
- base-code-to-specific-pattern mode (strict target for training)
- generation mode with preservation guarantees
- unit test support mode

## Unit Test and Code Generation Requirements

When a pattern context is selected, the system should be able to:
- generate code artifacts for the selected pattern or detected candidate scope
- generate test skeletons for pattern-defining behavior
- execute unit tests against generated or transformed outputs
- report pass/fail with links to source evidence and generated regions

## Suggested Markdown Artifacts

- Pattern_Detection_Report.md
- Pattern_Defining_Parts.md
- Pattern_Neutral_Parts.md
- Comment_Insertion_Map.md
- Unit_Test_Report.md

## Implementation Notes for Current Repository

- Keep pattern-specific detection logic delegated to module boundaries (for example, Creational and Behavioural modules).
- Keep syntactic pipeline responsible for parse graph, hash links, and orchestration.
- Ensure report serialization includes evidence paths and reasons for each classified code region.
