# `HeroLanding.tsx`

## Sole job

Hook the audience-profile reader (per D40) with a features-first promise and a single obvious next action. Surface-level only — no depth.

## Hard rule

Nothing on this page goes deeper than two sentences. Depth lives elsewhere. Per D42 information offloading.

## Layout (top to bottom)

### Above the fold

1. **Hook headline** — one line. Locked content: "Design Pattern tutor that auto-documents and auto-tests your code."
2. **Algorithm one-liner** — Locked content: "Powered by our own lexical-tagging + parse-tree algorithm. Fast. Efficient."
3. **30-second demo embed slot** — `<video autoplay muted loop playsinline>` reading from `Codebase/Frontend/public/demo/landing-30s.webm` (placeholder accepted while real recording is pending; falls back to a static poster image at `Codebase/Frontend/public/demo/landing-30s.jpg`).
4. **Three numbered steps** — locked wording:
   - **1** — "Paste your C++ (or load a sample)."
   - **2** — "We detect the design pattern."
   - **3** — "Get readable docs + integration tests, free."
5. **Single primary CTA** — "Try it now" → `/student-studio`.

### Below the fold (in this order)

6. **Features grid** (id: `features` — anchor target for nav). Six tiles per D43:
   1. Auto-documentation
   2. Auto-integration tests
   3. Pattern detection
   4. Readability score
   5. Sample library
   6. Run history

   Each tile: 1 verb-led title, 1 promise sentence, 1 thumbnail. **Zero pattern names** in this section.
7. **Why readability matters** — three small tiles linking to `/why`. Each shows industry name + one-line teaser. Click → `/why`.
8. **FAQ** — five items, one-line answers.
9. **Secondary CTA** — same destination as primary.

## Banned content on this page

- No GoF taxonomy.
- No pattern names.
- No algorithm pipeline diagrams (those live at `/mechanics`).
- No bios (those live at `/about`).
- No "see also" sections.

## Hard rules (per D41 and D42)

- One motion effect maximum: the demo video itself (and only because it's content). No aurora drift, no shiny text on headlines, no magnetic buttons, no tilt cards.
- Bento tiles are static. Hover = subtle border tint, no transform.
- The page must be readable with JS disabled (the demo gracefully falls back to its poster image).

## Components used

- `MagneticButton` (now non-magnetic per D41) for both CTAs.
- `Bento` tile primitives (new, see `components/marketing/bento/`).

## Route

`/` per D29 + D30.
