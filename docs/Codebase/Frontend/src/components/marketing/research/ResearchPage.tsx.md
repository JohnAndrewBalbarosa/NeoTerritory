# `ResearchPage.tsx`

## Sole job

Public bibliography of the books, papers, and prior art behind NeoTerritory. Reads from `docs/Research/`, which is the source of truth.

## Two layers

### `docs/Research/` — internal source of truth

```
docs/Research/
  README.md                       -- index of all entries
  books/
    dive-into-design-patterns.md  -- Shvets, Refactoring.Guru, 2024 (primary reference)
    head-first-2e.md              -- Freeman & Robson, O'Reilly, 2020
    modern-cpp-design.md          -- Alexandrescu, 2001 (still load-bearing for templates)
    effective-modern-cpp.md       -- Meyers, O'Reilly, 2014 (RAII + smart pointers)
  papers/
    lexical-analysis.md           -- prior art on tokenization for pattern detection
  industry-evidence/
    trading-readability.md        -- evidence for D40's quant-trader hook
    embedded-longevity.md         -- evidence for D40's embedded-programmer hook
  testing-trophy.md               -- D44 Testing Trophy strategy doc
```

Each entry is one Markdown file with frontmatter:

```yaml
---
title: "..."
authors: "..."
year: 2024
url: "..."
kind: book | paper | article | tooling
priority: primary | secondary | reference
---
```

Followed by:

- **Summary** — three sentences max.
- **Why it matters for this thesis** — one paragraph.
- **What we use from it** — bullet list.

### `ResearchPage.tsx` — public-facing render

- Fetches a static `research-index.json` generated at build time from `docs/Research/` (or imports the markdown directly via Vite glob — simpler).
- Renders one card per entry, grouped by `kind`.
- Each card: title, authors, year, summary, link.
- Single page, no detail routes — clicking a card opens the external URL in a new tab.

## Hard rules

- No teaching content here. The page is a directory.
- No mention of patterns by name. This is the prior-art surface, not the pattern reference.
- Effects budget = 1: subtle card hover, no other motion.

## Route

`/research` per D43. Not in top nav.
