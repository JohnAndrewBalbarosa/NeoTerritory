# Playwright e2e + screenshots

Two specs live under `playwright/tests/`:

| Spec | Purpose |
|------|---------|
| `all-samples.spec.ts` | Pipeline gate. Iterates every design-pattern sample under `Codebase/Microservice/samples/` and asserts the studio flow works end-to-end (load → analyze → tag → run tests → compile pass). This is the GitHub Actions blocker. |
| `studio-screenshots.spec.ts` | Dynamic-aware screenshot walkthrough. Walks every studio tab in narrative order and writes numbered PNGs to `playwright/screenshots/studio-walkthrough/`. Useful for manuscript figures, marketing pages, and onboarding decks. |

## Running

```bash
# Run everything
pnpm run test:e2e

# Run just the screenshot walkthrough
pnpm run test:e2e:screenshots
```

Both specs assume a stack on `http://127.0.0.1:3001`. Set `PLAYWRIGHT_BASE_URL` to point elsewhere (e.g. a preview deploy):

```bash
PLAYWRIGHT_BASE_URL=https://preview.example.com pnpm run test:e2e:screenshots
```

## Dynamic-content awareness

The studio is a heavily-streamed surface: SSE phase rows on the Tests tab,
lazy-mounted React subtrees, motion/react CSS transitions, joyride
overlays. A `page.waitForTimeout(2000)` is the wrong tool because the
content finishes on its own clock.

`playwright/helpers/waitForStable.ts` watches three signals and only
returns when all three have been quiet for the configured window:

1. **DOM mutations** — `MutationObserver` on `document.body` with
   `childList + subtree + attributes + characterData`. Any change resets
   the quiet window.
2. **Running animations** — `document.getAnimations()` filtered by
   `playState === 'running'`. Catches motion/react transitions, CSS
   keyframes, and any Web Animations API choreography.
3. **Network in-flight** — `request` / `requestfinished` / `requestfailed`
   counters on the Playwright `Page`. Catches SSE chunks and lazy bundle
   loads.

Every screenshot in `studio-screenshots.spec.ts` is preceded by
`waitForStable()`, so the captured pixels are never mid-transition.

## Page Object Model

`playwright/pages/StudioPage.ts` wraps the studio operations every spec
repeats: seat claim, JWT inject, sample load (bypassing the modal),
analyze + status-card wait, tab switch, SSE-stream completion, and
numbered screenshot output. New specs should reuse the POM rather than
re-implement these primitives inline.

## Output layout

```
playwright/
  screenshots/
    studio-walkthrough/
      01-studio-loaded-empty.png
      02-submit-tab-pre-load.png
      03-submit-tab-sample-loaded.png
      04-submit-tab-analysis-ready.png
      05-patterns-tab-classtree.png
      06-patterns-tab-fullpage.png
      07-tests-tab-idle.png
      08-tests-tab-results.png
      09-tests-tab-results-fullpage.png
      10-docs-tab.png
      11-docs-tab-fullpage.png
      12-selfcheck-tab.png
```

Step numbers are auto-managed by `StudioPage.snapshot()` so adding a
shot in the middle does not require renumbering the rest.
