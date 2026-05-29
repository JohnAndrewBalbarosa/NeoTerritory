// Manifest-driven route smoke. Reads tests/routes.manifest.json (project
// root) and verifies every row: page reachable with the expected status,
// the named data-testid is present, and any required text appears.
//
// Why this exists: CI's static-URL specs kept breaking whenever a route
// was renamed or moved. The manifest is the single contract — if a route
// changes, the manifest changes in the same commit. See CLAUDE.md >
// 'CI/CD Routes Manifest' for the hard rule.

import { test, expect } from '@playwright/test';
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

// playwright/tests → ../../../tests/routes.manifest.json
const manifestPath = resolve(
  __dirname,
  '..', '..', '..', '..',
  'tests', 'routes.manifest.json',
);
const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// PLAYWRIGHT_BASE_URL overrides the manifest's baseUrl so the same spec can run against
// the Next app (`next start` on :3000 in routes-manifest.yml — B2.3/D89) or any other host,
// while the manifest's own baseUrl (:3001) stays the sensible default for local runs.
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || manifest.baseUrl;

test.describe('routes manifest coverage', () => {
  for (const row of manifest.routes) {
    // Admin routes are not exercised here without seeded admin auth —
    // the per-prompt manifest gate is for public/guest coverage. Admin
    // route verification belongs in a separate spec with login fixtures.
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
    });
  }
});
