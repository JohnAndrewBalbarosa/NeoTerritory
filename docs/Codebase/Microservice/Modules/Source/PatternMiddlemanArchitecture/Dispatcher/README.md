# Dispatcher

## Purpose
Dispatcher selects hook groups and calls hooks through the shared contract.

## Files As Implementation Units
- `pattern_hook_dispatcher.md` represents hook routing.
- It decides which pattern hooks run.
- It keeps Behavioural and Creational selection inside one shared pipeline.

## Folder Flow
```mermaid
flowchart TD
    Start["Dispatcher"]
    N0["Select family"]
    N1["Load hooks"]
    N2["Call hooks"]
    End["Results ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
