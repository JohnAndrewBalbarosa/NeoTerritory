# Registry

## Purpose
Registry owns shared class and function registration after class declarations are generated.

## Files As Implementation Units
- `pattern_registry.cpp.md` represents the shared registry builder.
- It is called once after class declaration generation and before hook dispatch.
- It replaces repeated registration inside each design pattern.

## Folder Flow
```mermaid
flowchart TD
    Start["Registry"]
    N0["Read declarations"]
    N1["Register classes"]
    N2["Register functions"]
    N3["Store records"]
    End["Registry ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
