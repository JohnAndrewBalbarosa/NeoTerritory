# `core.cpp`

- Folder: `docs/Codebase/Microservice/Modules/Source/Trees/MainTree`
- Role: ownership map for the main tree root and the file-level branches attached under it

## Start Here
- Read this file first if you want to understand where the actual branch lives, where the virtual-broken branch lives, and when each one is allowed to attach.

## Quick Summary
- The main tree has one entry root.
- Each direct child of that root is a file node.
- Each file node owns actual class-declaration subtrees first and may later gain virtual-broken evidence branches for classes that passed structural pattern analysis.

## Why This Folder Is Separate
- The rooted ownership model is different from class-level generation.
- `MainTree/` explains where branches are allowed to exist.
- `ClassGeneration/` explains how those branches are built and validated.

## Major Workflow
```mermaid
flowchart TD
    N0["Start main root"]
    N1["Create file node"]
    N2["Attach actual branch"]
    N3["Build class subtree"]
    N4["Register subtree head"]
    N5["Analyze pattern structure"]
    N6["Attach virtual evidence"]
    N7["Keep actual only"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5
    N5 -->|match| N6
    N5 -->|no match| N7
```

## Structure Rules
- Root direct children are file nodes.
- Under each file node, the actual parse-tree path is part of the main tree as soon as generation begins.
- Class declaration and class implementation distinctions can appear in both actual and virtual-broken branches.
- Structural pattern analysis starts only after the actual class-declaration subtree is complete and registered.
- The virtual-broken branch is not attached to the file node until the completed class subtree has matched a pattern scaffold.
- The class registry must point to subtree heads, not duplicate tree content. After a class is accepted, its registry record should be able to reference the actual subtree head and, when present, the attached virtual-broken evidence head.

## Attachment Rules
- Actual branch: attached immediately because it records the literal source structure.
- Virtual-broken branch: detached after a pattern match because it is evidence, not the source-truth branch.
- On no match: continue with the next class while the actual branch stays intact.
- On match: attach the finished virtual-broken evidence branch under the same file node.
- On match, update or finalize the class registry record so the `std::hash`-derived class key can resolve back to the actual and virtual subtree heads.

## Acceptance Checks
- The docs show one entry root with file nodes as direct children.
- The actual branch is always described as rooted early.
- Structural pattern analysis is always downstream of actual class-subtree generation.
- The virtual-broken branch is always described as detached until pattern success.
- The registry pointer target is described as subtree heads for actual and virtual branches.
