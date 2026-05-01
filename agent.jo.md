# Claude (agent.jo) Operating Rules

This file is the source of truth for how Claude approaches implementation work in this repo.
Based on `AGENTS.md`. Claude-specific rules override defaults where they differ.

---

## Hard Boundary — Logic Is Off-Limits

The following folders must never be touched under any circumstance:

| Folder | Reason |
|--------|--------|
| `Codebase/Backend/` | Server logic, auth, routes, services |
| `Codebase/Microservice/` | C++ analysis engine |
| `Codebase/Infrastructure/` | Deployment, k8s, bootstrap scripts |

Do not read, edit, create, or delete files inside these folders. No exceptions.
If a frontend change seems to require touching one of these, stop and ask the user first.

---

## UI Structure Ground Truth

The existing HTML structure in `Codebase/Frontend/index.html` and `Codebase/Frontend/admin.html`
is the source of truth for div groupings and block layout.

**Default behavior:** almost copy the general groupings as-is.

- Top-level sections (`.shell`, `.topbar`, `.content`, `.panel`, `.admin-shell`, etc.) stay where they are.
- Block groupings inside panels (e.g. `panel-head`, `form-row`, `results-grid`, `pattern-cards`, stat cards, chart panels) stay as-is.
- IDs and `aria-*` attributes must not be changed unless the task explicitly requires it, because JavaScript in `app.js` / `admin.js` depends on them.

**If a task requires changing div structure** (adding, removing, or restructuring blocks beyond simple
content/style edits): present the proposed change as a table (see below) and wait for user verification
before proceeding.

---

## Change Proposal Table

Before implementing any structural div change, present this table to the user:

| # | Problem | Change to implement | Why this change |
|---|---------|-------------------|-----------------|
| 1 | _what is broken or missing_ | _exact structural edit (which element, from→to)_ | _why this is the right fix_ |

Only proceed after the user confirms.

For pure CSS / pure text / pure content changes (no structural div changes), no table is needed — just implement.

---

## Allowed Scope

Claude may freely edit:

- `Codebase/Frontend/styles.css`
- `Codebase/Frontend/admin.css`
- `Codebase/Frontend/index.html` — content and style edits only (verify before structural changes)
- `Codebase/Frontend/admin.html` — content and style edits only (verify before structural changes)
- `Codebase/Frontend/app.js` — UI behavior only, no backend call changes
- `Codebase/Frontend/admin.js` — UI behavior only, no backend call changes
- `docs/**` — documentation files
- `CLAUDE.md`
- `agent.jo.md` (this file)

---

## Source of Truth Hierarchy

1. User instruction in the current turn (highest)
2. `docs/Codebase/DESIGN_DECISIONS.md`
3. Existing div/block structure in the HTML files
4. `docs/Codebase/Frontend/` docs
5. `CLAUDE.md`
6. `AGENTS.md`
7. This file (`agent.jo.md`)

---

## Team Collaboration Rules

This project is a group frontend project. Joy handles UI only. Logic and functionality are owned by a teammate.

| Rule | Detail |
|------|--------|
| **Scope** | UI/JSX only — no logic, no functionality, no non-UI code |
| **Before implementing** | Validate and confirm related logic with teammate first |
| **Agreement gate** | All changes must be agreed upon by both sides before proceeding |
| **Merge strategy** | Each task is merged directly into `main` after review and confirmation |
| **Before continuing work** | Always pull the latest `main` to avoid working on a stale base |
| **Shared core files** | Edit only with explicit coordination from both sides |
| **Merge conflicts** | Review both versions, keep the correct code, remove conflict markers, resolve before committing — never blindly pick one side |
| **Communication** | Discuss before implementing — do not surprise the teammate with structural changes |

Claude must treat any file that touches logic or functionality as if it is in the hard-boundary list above — do not edit without teammate confirmation relayed by the user.

---

## Implementation Style

- Do not change logic; change only appearance, layout, and text.
- Do not introduce new JS dependencies or CDN links without asking.
- Do not rename existing CSS classes that are referenced in JS.
- Keep existing `id=` attributes intact unless the task explicitly targets them.
- Match the visual language already present (Inter font, JetBrains Mono for code, CSS variable palette).
