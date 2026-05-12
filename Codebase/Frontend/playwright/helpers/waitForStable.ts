import type { Page, Locator } from '@playwright/test';

// Dynamic-aware "the page is done changing, screenshot is safe" helper.
//
// A naive `await page.waitForTimeout(2000)` is brittle for two reasons:
//   1. Real dynamic content (SSE rows, lazy-mounted React subtrees, joyride
//      overlays) finishes on its own clock - sometimes faster, sometimes
//      slower than the magic-number sleep.
//   2. CSS animations (motion/react, transition: ease-out) can still be
//      mid-flight even after the DOM has settled, producing blurry pixels.
//
// This helper waits on three independent signals and only resolves when
// all three have been quiet for `quietWindowMs`:
//   - DOM mutations via MutationObserver
//   - Running animations via document.getAnimations()
//   - Network in-flight count (request/response counter on the Page)
//
// If any signal fires inside the quiet window, the window resets.
//
// The helper has an absolute `timeoutMs` so it never blocks forever.

export interface WaitForStableOptions {
  /** How long the page must be quiet (no mutations / animations / requests) before resolve. Default 400ms. */
  quietWindowMs?: number;
  /** Hard upper bound. Resolve anyway after this many ms even if the page never fully quiets. Default 8000ms. */
  timeoutMs?: number;
  /** Optional locator: also require this to be visible before considering the page stable. */
  visible?: Locator;
}

export async function waitForStable(
  page: Page,
  opts: WaitForStableOptions = {},
): Promise<void> {
  const quietWindowMs = opts.quietWindowMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 8000;

  // Network in-flight counter: tracked on the Page via request/response events.
  // We can't read this from inside evaluate(), so we mirror it onto a
  // pageHandle counter and re-read with each tick.
  let inFlight = 0;
  const onReq = (): void => {
    inFlight += 1;
  };
  const onDone = (): void => {
    inFlight = Math.max(0, inFlight - 1);
  };
  page.on('request', onReq);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  try {
    if (opts.visible) {
      await opts.visible.waitFor({ state: 'visible', timeout: timeoutMs });
    }

    const start = Date.now();
    // Each iteration:
    //   1. Read DOM-mutation + animation activity inside the page.
    //   2. Add in-flight network count from outside.
    //   3. If everything was quiet for the entire quiet window, return.
    //   4. Else sleep a tick and re-check, up to timeoutMs.
    while (Date.now() - start < timeoutMs) {
      const pageBusy = await page.evaluate(async (quietMs) => {
        // Inside this evaluate we sit and observe the page for quietMs.
        // We resolve to "busy" the moment we see a mutation or running
        // animation; we resolve to "quiet" if nothing happens for quietMs.
        return await new Promise<boolean>((resolve) => {
          let busy = false;

          // Mutation observer: any subtree change marks us busy.
          const mo = new MutationObserver(() => {
            busy = true;
            cleanup();
            resolve(true);
          });
          mo.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });

          // Animation poll: document.getAnimations() returns every running
          // CSS or Web Animations API animation. Length > 0 = busy.
          const animTick = window.setInterval(() => {
            const running = document.getAnimations().filter((a) => a.playState === 'running');
            if (running.length > 0) {
              busy = true;
              cleanup();
              resolve(true);
            }
          }, 50);

          const settleTimer = window.setTimeout(() => {
            cleanup();
            resolve(busy);
          }, quietMs);

          function cleanup(): void {
            mo.disconnect();
            window.clearInterval(animTick);
            window.clearTimeout(settleTimer);
          }
        });
      }, quietWindowMs);

      if (!pageBusy && inFlight === 0) {
        return;
      }
      // Quick re-poll: don't burn CPU, give the page a chance to settle.
      await page.waitForTimeout(50);
    }
    // Timed out. Don't throw - we'd rather take a "maybe slightly mid-animation"
    // screenshot than fail the entire walkthrough. The caller can decide.
  } finally {
    page.off('request', onReq);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
  }
}

// Helper used by screenshot specs: tucks the page into a known scroll state,
// hides anything that can't be deterministically captured (Joyride overlays,
// blinking cursors), and runs waitForStable.
export async function prepareForShot(
  page: Page,
  opts: WaitForStableOptions = {},
): Promise<void> {
  // Scroll to top so every screenshot has the same anchor.
  await page.evaluate(() => window.scrollTo(0, 0));
  // Hide any text input caret blinking.
  await page.addStyleTag({
    content: `
      * { caret-color: transparent !important; }
      .nt-research__bento-tile:focus-visible { outline: none !important; }
    `,
  });
  await waitForStable(page, opts);
}
