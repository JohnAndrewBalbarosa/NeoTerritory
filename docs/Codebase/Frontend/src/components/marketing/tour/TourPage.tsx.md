# `TourPage.tsx`

## Sole job

Show how the studio works, step by step, without requiring sign-in. Public revisitable walkthrough. Same content source as the in-studio popup walkthrough (planned per D45 follow-up); both consume `tourSteps.ts` so they can never drift.

## Layout

- One section per step, scrollable single column.
- Each step: number, title, one paragraph (3 sentences max), one screenshot or annotated diagram, one "what this lets you do" sentence.
- Top sticky `Step N of M` indicator (same component as `/mechanics`).
- Bottom CTA: "Try it now" → `/student-studio`.

## Steps (initial set; expand as the studio grows)

1. **Sign in** — Google or tester credentials. Why we need it: to save your runs.
2. **Land in the Submit tab** — see the Start Here rail (per D45).
3. **Load a sample** — pick from the sample library; the sample drops into slot 1.
4. **Click Analyze** — the C++ microservice runs; pattern cards appear when done.
5. **Read the pattern card** — name + confidence + evidence anchors.
6. **Generate documentation** — request AI doc; watch the chunked progress; receive per-line explanations.
7. **Save the run** — submit per-run review; the run + review cascade together.
8. **Open run history** — every saved run is replayable.

## Content source

`Codebase/Frontend/src/components/marketing/tour/tourSteps.ts` exports the array of steps as a typed const. The same file is consumed by:

- `TourPage.tsx` (this file) — for the public route.
- The in-studio popup component (future, per D45 companion popup walkthrough). Once that lands, both surfaces render from this single source.

Screenshots are stored under `Codebase/Frontend/public/tour/<step-slug>.png` and referenced via the `image` field on each step.

## Hard rules

- No motion beyond the sticky indicator. Per D41 effects budget.
- No mention of `/learn`, `/mechanics`, `/patterns`, etc. The page is self-contained per D42.
- Screenshots are static PNG/JPG, never auto-generated, never animated.

## Route

`/tour` per D43. Not in top nav. Reached from Home bento and from a "Take the tour" link on the Studio Start Here rail (planned).
