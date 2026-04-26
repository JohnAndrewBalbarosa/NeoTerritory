# `core.cpp`

- Folder: `docs/Codebase/Microservice/Modules/Source/Trees`
- Role: stage-wide workflow for rooted tree ownership and class-declaration subtree generation

## Start Here
- Read this file first for the tree-stage workflow.
- Then read `MainTree/`, `ClassGeneration/`, and `Shared/` in that order.

## Quick Summary
- This stage creates one rooted tree model with file nodes at the top.
- For each class, it builds the actual class-declaration subtree first and registers that subtree as the pattern-analysis target.
- Detached virtual-broken branches are optional evidence branches created after structural pattern analysis accepts a candidate.

## Why This Stage Is Separate
- `Analysis/` decides structure and usage meaning.
- `Trees/` materializes the rooted branches and class-level subtrees from that structural understanding.
- `HashingMechanism/` gives those tree nodes propagated identity and reconnectable lookup paths.
- `Diffing/` asks this stage to locate and regenerate only affected subtrees.

## Major Workflow
```mermaid
flowchart TD
    N0["Create file node"]
    N1["Attach actual branch"]
    N2["Build class subtree"]
    N3["Register subtree head"]
    N4["Hand to pattern analysis"]
    N5["Create virtual evidence"]
    N6["Keep actual only"]
    N7["Move to next class"]
    N0 --> N1 --> N2 --> N3 --> N4
    N4 -->|match| N5 --> N7
    N4 -->|no match| N6 --> N7
```

## Handoff
- Receives structural context from `../Analysis/core.cpp.md`.
- Hands to `../HashingMechanism/core.cpp.md` when tree nodes need reverse-Merkle identity and hash-link lookup.
- Serves `../Diffing/core.cpp.md` by exposing affected actual subtree boundaries and virtual-broken equivalents.

## Local Ownership
- `MainTree/` owns root and file-node attachment rules.
- `ClassGeneration/` owns class-declaration subtree generation.
- `ClassGeneration/Actual/` owns the literal class subtree that stays rooted in the main tree.
- `ClassGeneration/VirtualBroken/` owns detached strict-structure evidence created after pattern analysis accepts a completed class subtree.
- `ClassGeneration/Attachment/` owns the final attach-or-discard decision.
- `Shared/` owns helpers used by more than one tree subtype.

## Acceptance Checks
- The docs say virtual copy and broken AST are the same branch.
- The docs say the actual class-declaration subtree is generated before structural pattern analysis.
- The docs do not imply that actual-tree growth is downstream of expected-structure checking.
- The docs say the virtual-broken branch is detached evidence and attaches only after a matched class subtree is accepted.
- Shared helpers stay inside `Shared/`.
- Tree construction is readable as one stage-level workflow.
