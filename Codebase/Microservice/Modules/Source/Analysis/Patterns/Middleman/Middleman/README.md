# Middleman

## Purpose
Middleman owns the end-to-end catalog recognition process and delegates only pattern-specific evidence checks to hooks.

## Files As Implementation Units
- `pattern_middleman.cpp.md` represents the one shared orchestration module.
- Behavioural and Creational catalog definitions pass through this same file.
- Shared logic overlaps here instead of being copied into separate family paths.

## Folder Flow
```mermaid
flowchart TD
    Start["Middleman"]
    N0["Receive catalog"]
    N1["Build registry"]
    N2["Build context"]
    N3["Dispatch checks"]
    N4["Assemble matches"]
    End["Return result"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```
