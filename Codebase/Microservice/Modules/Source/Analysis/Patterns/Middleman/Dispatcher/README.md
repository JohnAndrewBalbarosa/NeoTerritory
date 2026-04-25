# Dispatcher

## Purpose
Dispatcher iterates catalog definitions, selects needed hooks, and calls hooks through the shared contract.

## Files As Implementation Units
- `pattern_hook_dispatcher.cpp.md` represents hook routing.
- It decides which pattern hooks run for each catalog definition.
- It keeps Behavioural and Creational selection inside one shared pipeline.

## Folder Flow
```mermaid
flowchart TD
    Start["Dispatcher"]
    N0["Read catalog"]
    N1["Pick pattern"]
    N2["Load hooks"]
    N3["Call hooks"]
    End["Results ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
