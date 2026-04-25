# Context

## Purpose
Context carries shared data from the middleman to hooks.

## Files As Implementation Units
- `pattern_context.cpp.md` represents the immutable recognition context.
- It carries catalog definitions, registry data, symbols, and options.
- Hooks read this context instead of rebuilding shared state.

## Folder Flow
```mermaid
flowchart TD
    Start["Context"]
    N0["Read catalog"]
    N1["Read registry"]
    N2["Read symbols"]
    N3["Read options"]
    End["Context ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
