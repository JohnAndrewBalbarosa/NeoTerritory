# Hooks

## Purpose
Hooks contain pattern-specific algorithms used when catalog rules need custom evidence. They are the only parts that differ by pattern family.

## Files As Implementation Units
- `Creational/*_hook.cpp.md` files represent Creational algorithms.
- `Behavioural/*_hook.cpp.md` files represent Behavioural algorithms.
- Hook files do not own class registration, context creation, dispatch, or tree assembly.
- Hook files receive catalog definitions instead of relying on user-selected source-pattern input.

## Folder Flow
```mermaid
flowchart TD
    Start["Hooks"]
    N0["Read pattern"]
    N1["Open family hook"]
    N2["Check class"]
    N3["Return evidence"]
    End["Middleman resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
