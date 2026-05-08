# Frontend folder convention

Strict separation between **logic** and **UI** so contributors know where to make changes:

| Folder | What goes here | What does NOT go here |
|--------|----------------|------------------------|
| `logic/` | Pure derivation, models, transformations, propagation rules, canonicalization, parsers. No JSX, no React-specific imports. | UI rendering, JSX, component state |
| `components/` | React components (JSX, props, hooks). Presentational + container. | Heavy data derivation — call into `logic/` instead |
| `hooks/` | Reusable behavioral hooks (effects, polling, browser APIs). | Pure data transforms — those belong in `logic/` |
| `store/` | Zustand stores, persisted client state. | UI rendering, derivation chains |
| `api/` | Backend HTTP client, request/response shapes. | Caching, derivation, UI |
| `types/` | TypeScript type/interface declarations. | Runtime code |
| `admin/` | Admin-only surface (separate app); has its own `admin/lib/` and `admin/components/` for admin-private code. | Mix of admin and main-studio code |

## Rule of thumb

> If you change a tagging rule, a cascade behavior, a derivation, or how data flows — **edit `logic/`**.
> If you change how something looks or interacts — **edit `components/`**.
> If both must change, change `logic/` first, then mirror in `components/` via props.

## Why

- Single source of truth for tagging, classification, and propagation lives in `logic/`
- UI components stay presentational and re-render correctly when the model changes
- Easier to test logic in isolation (no DOM, no React)
- Easier code review: a PR touching only `components/` is visual; only `logic/` is behavior
