// Behavioral spec for the merged "documented source" surface.
//
// The Patterns tab now renders a single unified spine anchored at
// [data-testid="documented-source"]. Collapsible sections are driven by
// .pattern-header elements whose toggle is .pattern-header__toggle; opening
// adds .pattern-header--open to the header. Inline per-line documentation
// renders as .inline-line-doc and is visible by default.
//
// The analysis trigger sequence is copied verbatim from all-samples.spec.ts
// (same seat-claim, same JWT inject, same textarea fill, same wait signal)
// so a picker-side bug never masks a documented-source-surface bug.
//
// Sample used: config_registry.cpp (Singleton). This sample is known to
// produce a non-empty class tree with pattern annotations AND inline line
// docs. It requires the live stack (backend + microservice) to be up.
// See all-samples.spec.ts for the full pipeline contract.

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Seat management — one shared seat for the whole describe block, following
// the same pattern as all-samples.spec.ts to avoid pool exhaustion.
// ---------------------------------------------------------------------------

const SHARED_SEAT: { username: string; token: string; user: unknown } = {
  username: '',
  token: '',
  user: null,
};

async function claimSharedSeat(apiRequest: APIRequestContext): Promise<void> {
  if (SHARED_SEAT.token) return;
  const accountsRes = await apiRequest.get('/auth/test-accounts');
  expect(accountsRes.ok(), 'tester accounts endpoint should answer').toBeTruthy();
  const body = (await accountsRes.json()) as {
    accounts: Array<{ username: string; claimed?: boolean }>;
  };
  expect(
    body.accounts.length,
    'at least one tester account must be seeded (SEED_TEST_USERS=1 in CI env)',
  ).toBeGreaterThan(0);
  const target = body.accounts.find((a) => !a.claimed) ?? body.accounts[0];
  const claimRes = await apiRequest.post('/auth/claim', {
    headers: { 'Content-Type': 'application/json' },
    data: { username: target.username },
  });
  expect(claimRes.ok(), `/auth/claim for ${target.username} should succeed`).toBeTruthy();
  const claim = (await claimRes.json()) as { token: string; user: unknown };
  SHARED_SEAT.username = target.username;
  SHARED_SEAT.token = claim.token;
  SHARED_SEAT.user = claim.user;
}

async function releaseSharedSeat(apiRequest: APIRequestContext): Promise<void> {
  if (!SHARED_SEAT.token) return;
  try {
    await apiRequest.post('/auth/disconnect', {
      headers: { Authorization: `Bearer ${SHARED_SEAT.token}` },
      data: { username: SHARED_SEAT.username },
    });
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// Sample source — read from disk, same path resolution as all-samples.spec.ts
// ---------------------------------------------------------------------------

const SAMPLES_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'Microservice',
  'samples',
);

// config_registry.cpp is the Singleton sample: clean detection, fast compile,
// known to produce inline line docs on the documented-source surface.
const SAMPLE_FILENAME = 'config_registry.cpp';
const SAMPLE_DIR = 'singleton';

function readSampleSource(): string {
  return fs.readFileSync(path.join(SAMPLES_ROOT, SAMPLE_DIR, SAMPLE_FILENAME), 'utf8');
}

// ---------------------------------------------------------------------------
// Core trigger — replicates the exact sequence from all-samples.spec.ts:
//   signInWithSharedSeat → loadSampleByFilename → runAnalysis → annotated tab
// ---------------------------------------------------------------------------

async function runSample(page: Page): Promise<void> {
  // Inject JWT + suppress all joyride tours before first navigation.
  expect(SHARED_SEAT.token, 'shared seat must be claimed in beforeAll').toBeTruthy();
  await page.addInitScript(
    ({ token, user }) => {
      try {
        localStorage.setItem('nt_token', token);
        localStorage.setItem('nt_user', JSON.stringify(user));
        sessionStorage.setItem('nt-entry-flow', 'developer');
        localStorage.setItem('nt_start_here_dismissed', '1');
        localStorage.setItem('nt_studio_tour_completed', '1');
        for (const tab of ['submit', 'annotated', 'gdb', 'ambiguous']) {
          localStorage.setItem(`nt_studio_tour_completed__${tab}`, '1');
        }
      } catch {
        /* private mode or quota */
      }
    },
    { token: SHARED_SEAT.token, user: SHARED_SEAT.user },
  );

  // Land on the studio.
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
  await expect(page.getByTestId('load-sample-btn')).toBeVisible({ timeout: 15_000 });

  // Fill the editor directly from disk (bypass the picker modal).
  const source = readSampleSource();
  const editor = page.locator('textarea').first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(source);
  await expect(page.getByTestId('analyze-btn')).toContainText(/Run analysis \(1 file/i, {
    timeout: 5_000,
  });

  // Click Analyze and wait for the run to complete.
  const analyze = page.getByTestId('analyze-btn');
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(page.getByTestId('status-title')).toHaveText(/Analysis ready/i, {
    timeout: 60_000,
  });

  // Switch to the Patterns tab where the documented-source surface lives.
  await page.getByTestId('tab-annotated').click();
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.describe('merged documented source', () => {
  test.beforeAll(async ({ request }) => {
    await claimSharedSeat(request);
  });

  test.afterAll(async ({ request }) => {
    await releaseSharedSeat(request);
  });

  test('renders the documented source spine after analysis', async ({ page }) => {
    await runSample(page);
    await expect(page.locator('[data-testid="documented-source"]')).toBeVisible();
  });

  test('pattern headers start collapsed; expand on click', async ({ page }) => {
    await runSample(page);
    const header = page.locator('.pattern-header').first();
    await expect(header).not.toHaveClass(/pattern-header--open/);
    await header.locator('.pattern-header__toggle').click();
    await expect(header).toHaveClass(/pattern-header--open/);
  });

  test('inline line docs are visible by default', async ({ page }) => {
    await runSample(page);
    await expect(page.locator('.inline-line-doc').first()).toBeVisible();
  });
});
