import { defineConfig, devices } from '@playwright/test';

// Playwright config for NeoTerritory E2E. Per D68 (this turn): a single
// project that iterates every design-pattern sample under
// Codebase/Microservice/samples/ and asserts the full pipeline works
// (load sample -> analyze -> see pattern card -> run tests -> compile/run
// pass). This is the gate the GitHub Actions workflow flips for green.

export default defineConfig({
  testDir: './playwright/tests',
  // Safety-net release of any seat the spec persisted via the SEAT_FILE
  // contract. Survives worker crashes that skip test.afterAll — the
  // exact cascade that broke /auth/claim on the previous CI run.
  globalTeardown: require.resolve('./playwright/global-teardown.ts'),
  // The full-pipeline test loads a sample, runs analyze, runs tests, and
  // waits for backend responses. Generous timeout per test.
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
