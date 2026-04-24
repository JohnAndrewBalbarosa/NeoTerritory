# Registry

## Purpose
Registry owns shared class and function registration for all pattern families.

## Files As Implementation Units
- `pattern_registry.cpp.md` represents the shared registry builder.
- It is called once before hook dispatch.
- It replaces repeated registration inside each design pattern.

## Folder Flow
```mermaid
flowchart TD
    Start["Registry"]
    N0["Register classes"]
    N1["Register functions"]
    N2["Store records"]
    End["Registry ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
