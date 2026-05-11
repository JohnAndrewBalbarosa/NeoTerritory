# Research index

Source-of-truth bibliography for NeoTerritory. The public `/research` page reads from this directory.

Each entry is one Markdown file in a subdirectory by kind. Frontmatter shape:

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

Body sections, in fixed order:

1. **Summary** — three sentences max.
2. **Why it matters for this thesis** — one paragraph.
3. **What we use from it** — bullet list.

## Subdirectories

- `books/` — full-length references, GoF or close.
- `papers/` — academic prior art for the algorithm.
- `industry-evidence/` — sources backing the `/why` industry hooks per D40.
- `testing-trophy.md` — top-level testing strategy doc per D44.

## Adding a new entry

1. Create the file under the right subdirectory.
2. Fill all frontmatter fields. `priority: primary` means the work is foundational; `secondary` means it informed a decision; `reference` means we cite it but did not lean on it.
3. Update no other index — the public page reads the directory at build time.

## Conventions

- Use the canonical capitalisation of authors and titles.
- Year is the publication year of the edition we read.
- `url` is the most stable canonical URL (publisher's page > Amazon).
