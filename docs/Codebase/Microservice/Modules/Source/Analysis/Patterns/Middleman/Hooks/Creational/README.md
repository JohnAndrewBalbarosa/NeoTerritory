# Creational Hooks

## Purpose
Creational hooks inspect shared context and return creational evidence. They do not register classes and do not assemble trees.

## Files As Implementation Units
- `factory_hook.cpp.md` owns Factory checks.
- `singleton_hook.cpp.md` owns Singleton checks.
- `builder_hook.cpp.md` owns Builder checks.
- All three use the same middleman context and hook contract.

## Folder Flow
```mermaid
flowchart TD
    Start["Creational"]
    N0["Factory"]
    N1["Singleton"]
    N2["Builder"]
    N3["Return evidence"]
    End["Dispatcher resumes"]
    Start --> N0
    Start --> N1
    Start --> N2
    N0 --> N3
    N1 --> N3
    N2 --> N3
    N3 --> End
```
