# `core.cpp`

- Folder: `docs/Codebase/Microservice/Modules/Source/Trees/ClassGeneration/VirtualBroken`
- Role: generation rules for the detached virtual copy, which is the same branch as the broken AST in this subsystem

## Start Here
- Read this file first if you want to understand what the virtual-broken branch is, how it is built, and when it is thrown away.

## Quick Summary
- `VirtualBroken` is one concept, not two separate branches.
- It is a temporary, strict, pattern-shaped subtree built during class generation.
- It exists only while the class is being checked against expected structure.

## Why This Folder Is Separate
- The actual branch records what is really in the source.
- The virtual-broken branch records the expected structure for a specific pattern shape.
- Because this branch can fail and be discarded, its lifecycle must stay separate from the always-rooted actual branch.

## Major Workflow
```mermaid
flowchart TD
    N0["Start detached branch"]
    N1["Read lexical structure hints"]
    N2["Shape expected class subtree"]
    N3["Track declaration and implementation form"]
    N4["Check divergence"]
    N5["Keep branch alive"]
    N6["Stop generation and discard"]
    N0 --> N1 --> N2 --> N3 --> N4
    N4 -->|match so far| N5
    N4 -->|violation| N6
```

## Structure Rules
- This folder covers the same branch that older docs called the broken tree.
- The branch is created per class.
- It may include both declaration-side and implementation-side expectations for the same class.
- It is not attached to the main tree while validation is still in progress.

## Failure Rules
- If the class diverges from the expected strict structure, generation stops for this class only.
- The detached branch is released instead of being attached.
- The next detached branch starts only when the actual branch reaches the next class.

## Success Rules
- If the class finishes without structure violation, the completed detached branch becomes attachable.
- Attachment itself is handled by `../Attachment/core.cpp.md`.

## Acceptance Checks
- The docs explicitly say virtual copy and broken AST are the same branch.
- The docs explicitly say this branch is detached during generation.
- The docs explicitly say failure discards the branch per class.
