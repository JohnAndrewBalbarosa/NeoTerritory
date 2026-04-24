# main.cpp

- Folder: `docs/Codebase/Microservice/Modules/Source`
- Role: top-level conceptual entrypoint for the source-side analysis pipeline

## Start Here
This is the first file to read when you want the whole source-side flow before diving into any local folder.

## Main Intent
This subsystem reads source input, performs structural and lexical analysis, builds the rooted actual parse tree while simultaneously shaping a detached virtual-broken branch per class, propagates hash identity, resolves implementation use back to declarations, runs pattern analysis, and emits unit-test-ready and documentation-ready outputs.

## Reading Order
1. `Analysis/core.cpp.md`
2. `Trees/core.cpp.md`
3. `HashingMechanism/core.cpp.md`
4. `OutputGeneration/core.cpp.md`

## Runtime Shape
`Analysis/`, `Trees/`, and `HashingMechanism/` are separate documentation ownership folders, but their core runtime work overlaps during the per-file and per-class scan. Lexical structural events, actual-tree growth, detached virtual-broken growth, and hash propagation are coordinated in the same class-level pass.

## Major Handoffs
- `Analysis/` identifies structure, usage context, and pattern-relevant signals.
- `Trees/` roots the actual branch under file nodes and manages simultaneous per-class virtual-broken generation with attach-or-discard rules.
- `HashingMechanism/` gives those structures stable cascading identities and lookup paths.
- `OutputGeneration/` converts the analyzed bundle into tests, tags, reports, and rendered outputs.

## Flow
```mermaid
flowchart TD
    N0["Load source input"]
    N1["Start file and class scan"]
    N2["Emit lexical structure events"]
    N3["Grow actual tree with hashes"]
    N4["Verify expected structure"]
    N5["Grow detached virtual-broken branch"]
    N6["Stop detached branch"]
    N7["Finish class boundary"]
    N8["Resolve implementation use"]
    N9["Generate outputs"]
    N0 --> N1
    N1 --> N2 --> N4
    N1 --> N3 --> N7
    N4 -->|match so far| N5 --> N7
    N4 -->|violation| N6 --> N7
    N7 --> N8 --> N9
```

## Jump Directly To
- `Analysis/core.cpp.md` if you only want lexical, binding, or pattern logic
- `Trees/core.cpp.md` if you only want rooted tree ownership and simultaneous actual plus virtual-broken generation
- `HashingMechanism/core.cpp.md` if you only want reverse-Merkle and hash-link lookup
- `OutputGeneration/core.cpp.md` if you only want tests, tags, reports, or render outputs

## Acceptance Checks
- the whole source subsystem can be understood from this file before entering subfolders
- each later folder is a handoff stage, not a hidden top-level entrypoint
