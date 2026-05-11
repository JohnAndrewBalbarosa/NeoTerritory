import { test } from '@playwright/test';
import * as path from 'node:path';
import { StudioPage } from '../pages/StudioPage';

// Dynamic-aware screenshot walkthrough of the studio.
//
// What this does:
//   1. Claims a tester seat through the real /auth/test-accounts +
//      /auth/claim API (same pattern as all-samples.spec.ts).
//   2. Lands on /studio with the JWT pre-injected and the joyride tours
//      pre-dismissed in localStorage, so screenshots are not polluted by
//      "first-run" overlays.
//   3. Walks every studio tab in narrative order, taking a numbered
//      screenshot at each step. The numbering is auto-managed by the
//      StudioPage POM (snapshot() increments an internal step counter).
//   4. Every screenshot is preceded by waitForStable(): a 3-signal wait
//      that watches DOM mutations, running Web Animations, and in-flight
//      network requests, and only resolves when all three have been quiet
//      for the configured window. Magic-number sleeps are never used.
//
// Output: playwright/screenshots/studio-walkthrough/NN-<slug>.png
//
// Run locally:
//   pnpm exec playwright test playwright/tests/studio-screenshots.spec.ts
// Or via the npm script:
//   pnpm run test:e2e:screenshots
//
// The spec is intentionally a single long test (not split per tab) because
// every step depends on state established by the previous step (you can't
// see Tests-tab streaming without first running an analysis on the
// Submit tab). One test = one consistent narrative.

const SAMPLE_FILENAME = 'config_registry.cpp'; // Singleton sample. Clean detection, fast compile.

test.describe('Studio screenshot walkthrough', () => {
  // One worker is plenty; the seat is shared for the whole spec.
  test.describe.configure({ mode: 'serial' });

  let seat: Awaited<ReturnType<typeof StudioPage.claimSeat>>;

  test.beforeAll(async ({ request }) => {
    seat = await StudioPage.claimSeat(request);
  });

  test.afterAll(async ({ request }) => {
    if (seat) await StudioPage.releaseSeat(request, seat);
  });

  test('walk every tab and snapshot dynamic-aware', async ({ page }, testInfo) => {
    test.setTimeout(240_000);

    const outDir = path.resolve(
      testInfo.project.outputDir,
      '..',
      'screenshots',
      'studio-walkthrough',
    );
    const studio = new StudioPage(page, outDir);

    // 1. Land on the studio (auth pre-injected).
    await studio.signIn(seat);
    await studio.snapshot('studio-loaded-empty');

    // 2. Submit tab — load a sample so the editor has content to show.
    await studio.tab('submit');
    await studio.snapshot('submit-tab-pre-load');

    await studio.loadSample(SAMPLE_FILENAME);
    await studio.snapshot('submit-tab-sample-loaded');

    // 3. Run analysis. The status card transitions; screenshot once it has
    //    finished transitioning (waitForStable handles the wait).
    await studio.analyze();
    await studio.snapshot('submit-tab-analysis-ready');

    // 4. Patterns tab — class tree appears only after the analysis emits
    //    verdicts. The POM's tab() already calls waitForStable, but we
    //    pause once more for the lazy-mounted class tree.
    await studio.tab('annotated');
    await studio.snapshot('patterns-tab-classtree');

    // Patterns tab — collapsed pattern-card state (default). Full-page so
    // the card headers below the fold are captured.
    await studio.snapshot('patterns-tab-fullpage-collapsed', { fullPage: true });

    // 4b. PatternCard inner content. Each card on the Patterns tab is
    // collapsed by default — its .pattern-card-toggle hides the
    // ExplainSection, FunctionsSection, AnchorsSection, UsagesSection,
    // and TaggedUsagesSection. Click every toggle so the inner content
    // is captured (per user direction: the capture script must drive
    // the dynamic content inside SPA components, not just the outer
    // tab bar).
    const expandedCount = await studio.expandAllPatternCards();
    await studio.snapshot('patterns-tab-cards-expanded');
    await studio.snapshot('patterns-tab-fullpage-expanded', { fullPage: true });
    // eslint-disable-next-line no-console
    console.log(`[studio-screenshots] expanded ${expandedCount} pattern card(s)`);

    // 5. Tests tab — capture the BEFORE state (button enabled, no rows yet),
    //    then run the SSE stream and capture the AFTER state once every
    //    per-pattern phase row has landed and the "Running…" text is gone.
    await studio.tab('gdb');
    await studio.snapshot('tests-tab-idle');

    await studio.runTestsAndWait();
    await studio.snapshot('tests-tab-results');
    await studio.snapshot('tests-tab-results-fullpage', { fullPage: true });

    // 6. Docs tab — static once analysis is ready. waitForStable still
    //    runs in case Documentation lazy-loads a markdown bundle.
    await studio.tab('docs');
    await studio.snapshot('docs-tab');
    await studio.snapshot('docs-tab-fullpage', { fullPage: true });

    // 7. Self-check tab — gated behind GDB. If accessible the radios render;
    //    if still locked the empty-state renders. Either way, the screenshot
    //    is a real surface state.
    await studio.tab('ambiguous');
    await studio.snapshot('selfcheck-tab');

    // Final summary marker: the index file lists every shot in order so
    // downstream tooling (manuscript figures, marketing pages) can pick
    // them up without a separate manifest.
    await page.evaluate((dir) => {
      // eslint-disable-next-line no-console
      console.log(`[studio-screenshots] all shots written under ${dir}`);
    }, outDir);
  });
});
