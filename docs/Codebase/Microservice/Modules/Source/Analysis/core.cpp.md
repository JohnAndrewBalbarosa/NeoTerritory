# `core.cpp`

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis`
- Role: analysis-stage coordination for intake, lexical class facts, usage binding, and subtree-first pattern recognition

## Start Here
- Read this file first for the stage workflow.
- Then read `Input/`, `Lexical/`, `ImplementationUse/`, and `Patterns/` in that order.

## Quick Summary
- This stage emits the structural and usage context that tree generation, catalog recognition, and hash identity consume.
- It finds class candidates, captures ordered class token spans, hands class facts to `Trees/`, receives completed actual class-declaration subtree heads, binds usage back to declarations, and only then runs catalog-driven pattern recognition.
- The actual class-declaration subtree is the required input to structural pattern analysis. Pattern checks do not run from raw lexical events alone.

## Why This Stage Is Separate
- `Analysis/` decides structural meaning and usage binding.
- `Trees/` builds declaration-side tree views.
- `Patterns/Catalog/` loads supported pattern definitions after declaration generation has enough class facts.
- `HashingMechanism/` creates propagated identities and lookup chains.
- `Diffing/` can ask this stage to refresh lexical structure for changed source intervals.
- `OutputGeneration/` emits downstream artifacts.

## Major Workflow
The analysis flow is split into small Mermaid slices so the class-subtree handoff is visible without turning one diagram into an oversized pipeline.

### Intake And Class Facts
Quick summary: lexical analysis produces class facts and ordered token spans, but it does not accept design patterns.
Why this is separate: this stage is the local analysis work before `Trees/` materializes a class-declaration subtree.

```mermaid
flowchart TD
    N0["Load source inputs"]
    N1["Normalize file units"]
    N2["Tokenize source"]
    N3["Find class boundary"]
    N4["Capture token spans"]
    N5["Store class facts"]
    N6["Send declaration handoff"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5 --> N6
```

### Declaration Subtree Handoff
Quick summary: analysis pauses final pattern recognition until the actual class-declaration subtree exists.
Why this is separate: `Trees/` owns subtree materialization; this analysis file owns the before-and-after contract.

```mermaid
flowchart TD
    N0["Send class facts"]
    N1["Trees build subtree"]
    N2["Receive subtree head"]
    N3["Attach class registry"]
    N4["Build analysis context"]
    N5["Ready for patterns"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5
```

### Usage Binding
Quick summary: usage binding connects implementation use back to the completed class declarations and registered subtree heads.
Why this is separate: usage evidence is shared by hashing, reports, and pattern hooks, so it should be complete before catalog dispatch.

```mermaid
flowchart TD
    N0["Read subtree registry"]
    N1["Read usage tokens"]
    N2["Resolve class use"]
    N3["Resolve method use"]
    N4["Record usage evidence"]
    N5["Return bound context"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5
```

### Pattern Recognition
Quick summary: catalog and hook checks run against completed class subtrees, not raw scan state.
Why this is separate: this is the point where structural pattern analysis is allowed to start.

```mermaid
flowchart TD
    N0["Receive class subtree"]
    N1["Load catalog"]
    N2["Match token layout"]
    N3["Dispatch hooks"]
    N4["Collect evidence"]
    N5["Assemble matches"]
    N6["Emit pattern evidence"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5 --> N6
```

### Interval Refresh
Quick summary: diffing reuses the same order when only part of a source file changed.
Why this is separate: partial regeneration must preserve the class-subtree-first contract instead of running pattern checks directly on changed text.

```mermaid
flowchart TD
    N0["Receive changed interval"]
    N1["Rescan local tokens"]
    N2["Refresh class facts"]
    N3["Regenerate subtree"]
    N4["Rebind usage"]
    N5["Rerun patterns"]
    N6["Return update plan"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5 --> N6
```

## Handoff
- Hands to `../Trees/core.cpp.md` once lexical class facts are ready to become an actual class-declaration subtree.
- Receives completed class-subtree heads back into `Patterns/Catalog/` and `Patterns/Middleman/` for automatic recognition.
- Hands to `../HashingMechanism/core.cpp.md` once usage and structure need stable propagated identities.
- Serves `../Diffing/core.cpp.md` during interval checks by re-emitting lexical structural signals for changed regions.

## Local Ownership
- `Input/` owns source intake and argument-facing entry.
- `Lexical/` owns token scanning and structural event extraction.
- `ImplementationUse/` owns scope-aware usage binding such as `p1 -> Person`.
- `Patterns/` owns all-pattern recognition after actual class-declaration subtrees and analysis context exist.

## Acceptance Checks
- Structural scanning stays separate from tree generation.
- Actual usage binding is visible before hash-based lookup.
- Ordered class token streams are available before catalog recognition.
- Pattern checks run after actual class-declaration subtree generation instead of during class scanning.
- Mermaid diagrams show the class-subtree handoff before structural pattern analysis.
- New supported structures can be added through the pattern catalog before adding custom hook code.
