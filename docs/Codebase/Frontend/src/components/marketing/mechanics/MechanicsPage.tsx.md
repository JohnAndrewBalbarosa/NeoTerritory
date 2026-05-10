# `MechanicsPage.tsx`

## Sole job

Show how the NeoTerritory algorithm works, from raw C++ tokens to detected pattern + evidence file. Five sequential stages per D31. Deep technical content, but written for a reader who hasn't taken a compiler course (audience profile per D40).

## Five stages (locked order, do not reorder per D31)

1. **Lexical tagging** — what tokens look like. Visual: a small C++ snippet rendered with each token as a chip carrying its lexeme category from `lexeme_categories.json`.
2. **Simultaneous virtual + actual parse tree creation** — split-pane diagram. Left = the tree built from the original source (immutable). Right = the virtual copy that gets cross-referenced and tagged. Both grow together.
3. **Per-class cross-referencing** — graph diagram showing class A's usage_table pointing to function bodies inside class B.
4. **Post-creation: virtual-only inspection** — explanation that the actual class is already affected, so tagging touches the virtual copy only. One sentence + one diagram.
5. **Pre-templated pattern matching** — why testing is cheap because templates are pre-known. Show one catalog JSON snippet from `pattern_catalog/creational/builder.json` with annotations.

## Layout

- One section per stage, anchored (`#stage-1` through `#stage-5`).
- Each section: stage number, title, one paragraph (3 sentences max), one diagram or code snippet, one "what happens next" pointer (just the next stage's title — never a `/learn` or `/patterns` link).
- Top: a sticky stage indicator (`Stage 1 of 5`) that updates on scroll. Pure CSS sticky + IntersectionObserver — no animation library.

## Hard rules

- Effects budget = 1: scroll-progress only, no other motion. No spotlight, no tilt, no shiny text.
- Diagrams are SVG, hand-authored under `assets/mechanics/<stage>.svg`. No third-party diagram lib.
- Code snippets ≤ 15 lines per D40.
- Each stage definition stays consistent with `docs/Codebase/DESIGN_DECISIONS.md` D31. If the algorithm changes, update D31 BEFORE editing this page.

## Route

`/mechanics` per D46. Not in top nav.
