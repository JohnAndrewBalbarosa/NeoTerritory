# Merge Documentation + Pattern into a single line-by-line walkthrough

**Date:** 2026-05-25
**Status:** Approved design — pending implementation plan
**Surface:** Studio → Patterns tab (`AnnotatedTab`)

## Problem

The analysis result currently exposes the same teaching content across three
overlapping surfaces:

1. **Annotated** sub-view — `SourceView` + a sidebar of `PatternCards`
   (ExplainSection, Methods to test, Key landmarks, Where pattern fires,
   Where class shows up), plus `ClassTreeView` and `ClassBindings`.
2. **Documentation** sub-view — `DocumentationTab` (pattern definition, AI
   education, Code Annotations, Unit Tests, Documentation Targets, "How to read
   this page" guide).
3. **`LinePopover`** — shows annotation content *and* the rival-pattern picker.

The "what is X" explanation, the line-anchored landmarks, and the unit-test
targets all appear in **both** sub-views. The result is clutter and redundancy.
The goal is a single, decluttered surface where the documentation is explained
**line by line**, integrated with the detected pattern — "less is more" by
removing duplication, not by cutting teaching content.

## Decisions (locked)

- **Merge into one view.** Remove the `annotated | docs` sub-view toggle. One
  continuous source-spine surface.
- **Line-by-line UX = inline under each line.** Annotations render directly
  beneath the line they describe (like inline code-review comments).
- **Keep all teaching content**, but each piece appears exactly once. Declutter
  comes from removing duplication and folding line-anchored lists into the
  inline docs.
- **Keep export** (MD / PDF / DOCX); it serializes the merged walkthrough.
- **Remove the sidebar entirely** (`ClassTreeView` + `ClassBindings`); fold
  navigation into the existing ←/→ corner buttons + collapsible headers, and
  fold "where used" into inline usage notes. True single column.
- **Default state:** PatternHeaders collapsed (one-liner + badge only); inline
  line docs visible. Line-by-line walkthrough is front-and-center; pattern
  theory is one click away.
- **Docs vs decision are separate.** The `LinePopover` is narrowed to the
  disambiguation picker only; documentation content moves to the inline blocks.

## Architecture

The merge happens inside `AnnotatedTab.tsx`. The `view` state and the
`DocumentationTab` import are removed. One surface:

```
AnnotatedTab (shell)
├─ results-header (summary, AI pill, PatternLegend, export buttons ← moved here)
├─ tag-progress row (CTA state machine — unchanged)
├─ file-tab-bar (multi-file — unchanged)
└─ DocumentedSource  ← NEW spine (replaces SourceView usage + sidebar)
     per line:
       ├─ [if class decl line]  PatternHeader (collapsible, default collapsed)
       ├─ source line (gutter + code)   ← SourceView line-render logic, reused
       └─ [if annotated]        InlineLineDoc (annotation + docTarget + usage)
```

### Kept / reused

- `SourceView`'s line-rendering, colouring, scope, and dominance logic — reused
  inside `DocumentedSource`, **not** rewritten. The existing per-line colour
  priority (override → ambiguous chrome → strict canonical → none) is preserved.
- `LinePopover` — kept, **narrowed to disambiguation** (rival picker for
  ambiguous classes). Opens on click for ambiguous lines only.
- `tag-progress` CTA state machine (tag → gdb → submit → review) — unchanged.
- multi-file `file-tab-bar` — unchanged.
- ←/→ class-navigation corner buttons — kept (now the primary class navigator).

### Removed / absorbed

- `DocumentationTab.tsx` — content absorbed into `PatternHeader` + `InlineLineDoc`.
- `PatternCards.tsx` sidebar — 5 sections redistributed (see declutter map).
- `ClassTreeView.tsx`, `ClassBindings.tsx` — removed from the flow.
- `studio-subview-toggle` — removed.
- "How to read this page" `<details>` guide — dropped (inline UI is self-explanatory).

### New files (each needs a `docs/Codebase/...md` blueprint first, per mirror rule)

- `Codebase/Frontend/src/components/analysis/DocumentedSource.tsx`
- `Codebase/Frontend/src/components/analysis/PatternHeader.tsx`
- `Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx`
- `Codebase/Frontend/src/logic/documentedModel.ts` — pure mapping:
  line → `{ header?, annotations, docTargets, usages }`.

## Declutter map

All retained content persists; it appears once.

| Existing content | Today appears in | New home |
|---|---|---|
| What is X (oneLiner / AI explanation) | PatternCards ExplainSection + DocumentationTab | PatternHeader (once) |
| Why it fired | both | PatternHeader |
| When to use + analogy + watch-out | both | PatternHeader (collapsed by default) |
| Methods to test (`unitTestTargets`) | PatternCards + DocumentationTab | PatternHeader footer list |
| Key landmarks (`documentationTargets`) | PatternCards AnchorsSection + DocumentationTab | InlineLineDoc on its anchored line |
| Where pattern fires / usages | PatternCards UsagesSection + TaggedUsagesSection + ClassBindings | InlineLineDoc on each usage line |
| Code Annotations (title + comment) | DocumentationTab list | InlineLineDoc under the line |
| AI/Static source badge | per-row pills + banner | one pill in PatternHeader |
| "How to read this page" | DocumentationTab `<details>` | dropped |

## Building blocks

### `PatternHeader`

Renders at each class declaration line. Collapsible; **default collapsed**
(badge + class name + one-liner + AI/Static pill). Expanded:

```
▸ [Factory] ShapeFactory · AI explanation          (collapsed)
─────────────────────────────────────────────
▾ expanded:
   What is it?      <oneLiner or AI explanation>
   Why it fired     <whyThisFired>
   When to use      <whenToUse> · Analogy <…> · Watch out <…>
   Methods to test  ☐ build() L42 · ☐ make() L51   (click → flash line)
```

### `InlineLineDoc`

Renders directly beneath an annotated line, indented to align with the code.
**Visible by default.** Folds annotation + landmark + usage into one block:

```
 42 │  Shape* ShapeFactory::create(Type t) {
    ╰─ ● Factory method — entry point where the concrete type is chosen   [AI]
       landmark: create()   ·   used at L88, L91
```

- Left border inherits the line's pattern colour (reuses `--ann-border`).
- On an ambiguous line, the inline block stays minimal and the `LinePopover`
  picker opens on click — documentation and the disambiguation decision are
  visually and behaviourally separate.

## Export

All three exports serialize the full walkthrough (source + inline docs + headers).
Nothing is hidden from the export, including collapsed headers.

- **PDF & DOCX** — `contentRef` moves to wrap `DocumentedSource`. Interactive
  chrome (chevrons, picker buttons, ←/→ nav) gets a `.no-print` class. A
  `@media print` override renders all PatternHeaders expanded so collapsed
  on-screen state does not truncate the document.
- **Markdown** — `generateMarkdown` is re-authored to emit a line-oriented
  walkthrough: per class, a code fence of the scope lines with inline
  `// ← note` comments, followed by pattern-header bullets. It remains
  structural (no DOM dependency).
- Export buttons move from the old docs toolbar into `results-header`.
- `downloadDocx` / `triggerPdfPrint` HTML wrappers stay; print CSS extended for
  `.pattern-header` / `.inline-line-doc`.

## Testing, CI sync, docs mirror (project hard rules)

- **Routes manifest** — `subview-annotated` / `subview-docs` testids disappear.
  Confirm `tests/routes.manifest.json` anchors on `studio-shell` (not the
  subview). Add a stable `data-testid="documented-source"` to the new spine and
  update the manifest row if it referenced a removed selector.
- **Playwright** — update any spec that drives the `subview-docs` toggle to the
  single-view flow.
- **docs/Codebase mirror** — author `.md` blueprints for the 4 new files before
  coding; remove docs for `DocumentationTab` / `PatternCards` / `ClassBindings`
  / `ClassTreeView` when they leave the flow.
- **DESIGN_DECISIONS.md** — record the merge decision (single spine, header at
  decl line, docs-vs-picker split) before dependent code.
- **Unit tests** — `documentedModel.ts` is pure mapping logic → AAA unit tests
  (line → header / annotations / docTargets / usages), target 80%+.
- **Visual regression** — Playwright screenshots at 768 / 1024 / 1440, both
  themes, since this is the main results surface.
- **Rebuild** — frontend-only change; per CLAUDE.md the default post-change
  proposal is `./scripts/rebuild.sh` (micro+docker).

## Out of scope

- Reworking the matcher / microservice output. This is a frontend presentation
  merge only; the API payload (`detectedPatterns`, `annotations`,
  `documentationTargets`, `unitTestTargets`, `classUsageBindings`, `ranking`)
  is consumed as-is.
- Changing the ambiguity-resolution logic (picker, propagation, cascade).
- The standalone marketing Patterns/Docs pages — untouched.
