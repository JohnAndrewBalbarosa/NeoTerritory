# Context

## Purpose
Context carries shared data from the middleman to hooks.

## Files As Implementation Units
- `pattern_context.md` represents the immutable request context.
- It carries registry data, symbols, options, and family selection.
- Hooks read this context instead of rebuilding shared state.

## Folder Flow
```mermaid
flowchart TD
    Start["Context"]
    N0["Read registry"]
    N1["Read symbols"]
    N2["Read options"]
    End["Context ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
