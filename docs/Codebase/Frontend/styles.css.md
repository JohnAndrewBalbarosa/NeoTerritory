# styles.css

- Source: Frontend/styles.css
- Kind: Stylesheet

## Story
### What Happens Here

This stylesheet defines the entire visual surface of NeoTerritory Studio. It loads the Space Grotesk and IBM Plex Mono fonts, declares the design tokens (color palette, radius, shadow, font stacks), and styles every layout section declared in `index.html`: topbar, workspace, composer, editor shell, analysis rail, pipeline panel, score panel, comment threads, run history, and the source-modal dialog.

### Why It Matters In The Flow

Visual coherence of the single-page Studio comes from one stylesheet. There is no per-page CSS file. All themeing decisions and typographic rhythm live in the design tokens at the top of the file.

### What To Watch While Reading

Keep tokens centralized. New colors, shadows, or radii should be declared as `--*` variables on `:root` rather than inlined into individual selectors. Layout primitives (`.panel`, `.panel-head`, `.ghost-btn`, `.primary-btn`, `.mini-chip`, `.empty-state`) are reused across many sections — extending them is preferred over creating section-specific variants.

## Token Surface

The `:root` block exposes:
- Background tokens: `--bg`, `--bg-soft`, `--panel`, `--panel-2`.
- Text tokens: `--text`, `--muted`.
- Accent tokens: `--accent`, `--accent-2`, `--warn`, `--danger`.
- Layout tokens: `--line`, `--shadow`, `--radius`, `--radius-sm`.
- Typography tokens: `--mono`, `--sans`.

## Section Map

- Topbar (`header.topbar`) — eyebrow line, hero title, lede, pipeline chip row, status card.
- Workspace (`section.workspace`) — composer panel (file input, filename input, editor, annotation rail) plus the side stack (pipeline list, score panel).
- Bottom grid (`section.bottom-grid`) — comment threads panel and run history panel.
- Source modal (`dialog.source-modal`) — confirmation dialog for overwriting unsaved edits.
- CodeMirror overrides — line-active highlight, finding-line highlight, comment-anchor highlight.

## Acceptance Checks

- All colors used in component selectors resolve through `:root` design tokens (no raw hex inside section blocks except for severity badges).
- The stylesheet ships no vendor prefixes for browsers older than the CodeMirror baseline (modern evergreen).
- The stylesheet does not reference any image asset; iconography is text and CSS only.
