# Contracts

## Purpose
Contracts define the public shape of the single catalog-driven middleman and the pattern hooks.

## Files As Interfaces
- `pattern_middleman_contract.cpp.md` is the caller-facing recognition interface.
- `pattern_hook_contract.cpp.md` is the hook-facing algorithm interface.
- Both Behavioural and Creational code depend on these same contracts.

## Folder Flow
```mermaid
flowchart TD
    Start["Contracts"]
    N0["Read middleman"]
    N1["Read hook"]
    N2["Use both"]
    End["Contract ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
