# Hooks

## Purpose
Hooks contain the pattern-specific algorithms. They are the only parts that differ by pattern family.

## Files As Implementation Units
- `Creational/*_hook.md` files represent Creational algorithms.
- `Behavioural/*_hook.md` files represent Behavioural algorithms.
- Hook files do not own class registration, context creation, dispatch, or tree assembly.

## Folder Flow
```mermaid
flowchart TD
    Start["Hooks"]
    N0["Open Creational"]
    N1["Open Behavioural"]
    N2["Return evidence"]
    End["Middleman resumes"]
    Start --> N0
    Start --> N1
    N0 --> N2
    N1 --> N2
    N2 --> End
```
