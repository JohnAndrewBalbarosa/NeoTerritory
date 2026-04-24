# Middleman

## Purpose
Middleman owns the end-to-end process and delegates only the pattern-specific algorithm to hooks.

## Files As Implementation Units
- `pattern_middleman.cpp.md` represents the one shared orchestration module.
- Behavioural and Creational requests pass through this same file.
- Shared logic overlaps here instead of being copied into separate family paths.

## Folder Flow
```mermaid
flowchart TD
    Start["Middleman"]
    N0["Build registry"]
    N1["Build context"]
    N2["Dispatch hooks"]
    N3["Connect local nodes"]
    End["Return tree"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
