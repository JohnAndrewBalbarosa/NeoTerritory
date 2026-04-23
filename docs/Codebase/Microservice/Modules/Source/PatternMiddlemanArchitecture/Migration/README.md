# Migration

## Purpose
Migration docs describe how current design-pattern logic should move toward this implementation-shaped structure.

## Files As Planning Units
- `current_to_middleman.cpp.md` maps scattered current logic to this target file tree.
- It is the checklist for future code work, not a runtime module.

## Folder Flow
```mermaid
flowchart TD
    Start["Migration"]
    N0["Map current files"]
    N1["Move shared logic"]
    N2["Keep hooks"]
    End["Target shape"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
