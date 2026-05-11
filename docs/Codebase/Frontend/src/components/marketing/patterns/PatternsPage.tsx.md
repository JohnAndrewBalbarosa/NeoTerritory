# `PatternsPage.tsx` and `PatternDetailPage.tsx`

## Sole job

Reference catalog. **Not** a teaching surface. Lists every pattern NeoTerritory can detect, grouped by GoF family. Each pattern has its own detail page with intent + problem + solution + code sketch + "where NeoTerritory detects this."

## Two pages, same surface family

### `PatternsPage.tsx` — index

- Bento grid grouped by family: Creational / Structural / Behavioural / Idioms / Beyond GoF.
- Each tile: pattern name, one-line intent, "Detects from" badge (the JSON file in `pattern_catalog/<family>/<pattern>.json` if shipped, else "Reference only").
- Click → `/patterns/<slug>`.
- No teaching prose at the top. The page is a directory.

### `PatternDetailPage.tsx` — one route per pattern

Route: `/patterns/<slug>`. Sections, in fixed order:

1. **Intent** — one sentence.
2. **Problem** — three sentences max.
3. **Solution** — three sentences max + one ≤15-line code sketch.
4. **Where NeoTerritory detects this** — pointer into the catalog JSON shape (which `signature_categories` per D38, which `ordered_checks`).
5. **Sample** — link to `Codebase/Microservice/samples/<pattern>/...` if present, embedded as `?raw` import.

## Initial seed (8 patterns minimum, more later)

Pattern catalog already ships seven entries (per D21): Singleton, Factory, Builder, Method Chaining, Adapter, Proxy, Decorator. Add one Behavioural placeholder (Strategy) to seed the family. Other ~30 patterns from Refactoring.Guru's Dive Into Design Patterns (2024) added incrementally as catalog entries land.

## Hard rules

- Pattern names allowed here. This is the reference surface.
- No linking from a detail page to another pattern's detail page. Each detail page stands alone.
- Code samples bundled via Vite `?raw` import so changing the source `.cpp` file under `Codebase/Microservice/samples/` automatically updates the page.
- Effects budget = 1: subtle hover lift on tiles, no other motion.

## Route

- `/patterns` (index)
- `/patterns/<slug>` (detail)
- `/patterns/gof` (filtered subset showing only Creational / Structural / Behavioural)

Not in top nav per D43. Reached from the Home bento grid and from `/learn` contextual links.
