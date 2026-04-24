# current_to_middleman.cpp

## Role
Documents the accepted path migration for pattern analysis docs.

## Current Outer Split
```text
Patterns/
  Middleman/
  Families/
    Behavioural/
    Creational/
```

## Activity Flow
Quick summary: this migration keeps the shared middleman layer outside the family group, then routes family-specific docs through `Families/`.

Why this slice is separate: path migration is a docs-architecture concern; it should not be mixed with behavioural or creational implementation diagrams.

```mermaid
flowchart TD
    N0["Read pattern docs root"]
    N1["Keep middleman as shared sibling"]
    N2["Group families together"]
    N3["Move behavioural under families"]
    N4["Move creational under families"]
    N5["Rewrite old family paths"]
    N6["Verify links and entrypoints"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
```

## Direct Mapping
- Former top-level Behavioural family folder -> `Patterns/Families/Behavioural/`
- Former top-level Creational family folder -> `Patterns/Families/Creational/`
- `Patterns/Middleman/` stays at `Patterns/Middleman/`

## Naming Rules
- Family names belong under the `Families/` grouping folder.
- Middleman stays outside `Families/` because it is shared orchestration, not a family.
- File names should carry only the local implementation role once the folder path carries the family.

## Acceptance Checks
- `Patterns/Families/Behavioural/` exists.
- `Patterns/Families/Creational/` exists.
- `Patterns/Middleman/` exists as a sibling of `Patterns/Families/`.
- No durable docs point readers to top-level family folders.
