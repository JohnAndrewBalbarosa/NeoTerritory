// Mobile and tablet smoke for the public surfaces plus the unauthenticated
// admin entry screen. This spec runs only under the mobile/tablet Playwright
// projects defined in playwright.config.ts.

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface RouteRow {
  path: string;
  name: string;
  auth: 'public' | 'guest' | 'developer' | 'admin';
  expectStatus: number;
  expectSelector: string;
  expectText?: ReadonlyArray<string>;
}

interface Manifest {
  baseUrl: string;
  routes: ReadonlyArray<RouteRow>;
}

const manifestPath = resolve(
  __dirname,
  '..', '..', '..', '..',
  'tests', 'routes.manifest.json',
);
const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || manifest.baseUrl;

async function expectNoHorizontalOverflow(page: Page, route: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      bodyScrollWidth: body ? body.scrollWidth : 0,
    };
  });

  expect(
    overflow.docScrollWidth,
    `document overflowed horizontally on ${route}`,
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);

  expect(
    overflow.bodyScrollWidth,
    `body overflowed horizontally on ${route}`,
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test.describe('mobile layout smoke', () => {
  for (const row of manifest.routes) {
    if (row.auth === 'admin') continue;

    test(`${row.name} (${row.path})`, async ({ page }) => {
      const url = row.path.startsWith('http') ? row.path : `${baseUrl}${row.path}`;
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${url}`).not.toBeNull();
      expect(response!.status(), `bad status for ${row.path}`).toBe(row.expectStatus);

      await expect(
        page.locator(row.expectSelector),
        `expected selector ${row.expectSelector} on ${row.path}`,
      ).toBeVisible({ timeout: 10_000 });

      for (const needle of row.expectText ?? []) {
        await expect(
          page.getByText(needle, { exact: false }).first(),
          `expected text "${needle}" on ${row.path}`,
        ).toBeVisible({ timeout: 10_000 });
      }

      await expectNoHorizontalOverflow(page, row.path);
    });
  }

  test('admin shell redirects to login cleanly', async ({ page }) => {
    const url = `${baseUrl}/admin`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(response, `no response for ${url}`).not.toBeNull();
    expect(response!.status(), '/admin should render').toBe(200);

    await expect(page.locator('[data-testid="admin-login-shell"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Project Manager Sign-In', { exact: false })).toBeVisible({ timeout: 10_000 });

    await expectNoHorizontalOverflow(page, '/admin');
  });
});
