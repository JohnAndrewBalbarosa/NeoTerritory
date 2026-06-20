import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';

async function mockDashboardApi(page: Page): Promise<void> {
  const fulfillApi = async (route: Route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};

    if (url.pathname === '/api/health') {
      body = {
        service: 'CodiNeo',
        totalRuns: 0,
        aiProviderConfigured: true,
        reviewsRequired: false,
        microservice: { connected: true, binaryFound: true, catalogFound: true },
        docker: { enabled: false, imageReady: false, livePods: 0, reason: 'env_off', mine: false },
      };
    } else if (url.pathname === '/api/admin/users') {
      body = { users: [] };
    } else if (url.pathname === '/api/learning/modules') {
      body = { modules: [] };
    } else if (url.pathname === '/api/admin/learning/interns') {
      body = { interns: [] };
    } else if (url.pathname === '/api/admin/stats/learning-raw') {
      body = { students: [], progress: [], questionResults: [], examAttempts: [] };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  };

  await page.route('**/api/health', fulfillApi);
  await page.route('**/api/admin/**', fulfillApi);
  await page.route('**/api/learning/modules', fulfillApi);

  await page.route('**/auth/google/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: false }),
    });
  });

  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'project-manager-ui-token',
        user: {
          id: 1,
          username: 'Neoterritory',
          email: 'manager@example.test',
          role: 'admin',
          isOriginalDevs: true,
        },
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(overflow.documentWidth, `${label}: document overflow`).toBeLessThanOrEqual(overflow.innerWidth + 1);
  expect(overflow.bodyWidth, `${label}: body overflow`).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('Project Manager dashboard uses consistent terminology and responsive layout', async ({ page }) => {
  await mockDashboardApi(page);
  await page.addInitScript(() => {
    localStorage.removeItem('nt_token');
    localStorage.removeItem('nt_user');
    sessionStorage.clear();
  });

  const response = await page.goto(new URL('/admin.html', BASE_URL).toString(), {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status()).toBe(200);

  const fallback = page.locator('details.admin-login-legacy');
  await fallback.locator('summary').click();
  await fallback.getByLabel('Username').fill('Neoterritory');
  await fallback.getByLabel('Password').fill('project-manager-password');
  await fallback.getByRole('button', { name: 'Sign in with username/password', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Project Manager Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Learning Overview', exact: true })).toBeVisible();
  await expect(page.getByText('Intern Module Recommendations', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);

  for (const action of ['Go to my studio', 'Refresh', 'Sign out']) {
    await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible();
  }

  await expectNoHorizontalOverflow(page, 'desktop dashboard');
  await page.screenshot({
    path: 'playwright/screenshots/project-manager-dashboard-desktop.png',
    fullPage: true,
  });

  await page.getByTestId('admin-tab-bar').getByRole('button', { name: 'Interns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Intern Learning Records', exact: true })).toBeVisible();
  await page.getByTestId('admin-tab-bar').getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Learning Overview', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Project Manager Dashboard', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'mobile dashboard');
  await page.screenshot({
    path: 'playwright/screenshots/project-manager-dashboard-mobile.png',
    fullPage: true,
  });
});
