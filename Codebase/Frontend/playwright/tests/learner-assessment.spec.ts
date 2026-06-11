import { test, expect, type Page } from '@playwright/test';

const BLOOM_TAXONOMIES = new Set([
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
]);

const ASSESSMENT_ROUTES = [
  {
    path: '/pre-test',
    testId: 'pretest-page',
    title: /Baseline Assessment: Pre-Test/i,
  },
  {
    path: '/post-test',
    testId: 'posttest-page',
    title: /Post-Test$/i,
  },
  {
    path: '/post-test-2',
    testId: 'posttest2-page',
    title: /Post-Test, Part 2/i,
  },
] as const;

async function installAssessmentMocks(page: Page, includeLearnerSession = false): Promise<void> {
  await page.route('**/api/learning/modules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modules: [] }),
    });
  });

  if (includeLearnerSession) {
    await page.route('**/api/learning/assessments', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ attempts: [], answers: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });
  }
}

async function seedLearnerSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nt_token', 'pw-test-token');
      localStorage.setItem(
        'nt_user',
        JSON.stringify({
          id: 4101,
          username: 'pw-learner',
          email: 'pw-learner@example.com',
          role: 'user',
        }),
      );
      localStorage.setItem('nt_learning_unlock_all', '1');
    } catch {
      // Ignore private-mode or quota failures.
    }
  });
}

test.describe('learner assessment routes', () => {
  for (const row of ASSESSMENT_ROUTES) {
    test(`${row.path} renders Bloom-tagged MCQ content`, async ({ page }) => {
      await installAssessmentMocks(page);

      const response = await page.goto(row.path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${row.path}`).not.toBeNull();
      expect(response!.status(), `bad status for ${row.path}`).toBe(200);

      await expect(page.locator(`[data-testid="${row.testId}"]`)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('heading', { name: row.title })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.nt-assessment__items > li').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.nt-assessment__choices input[type="radio"]').first()).toBeVisible({ timeout: 10_000 });

      const taxonomyValues = await page.locator('.nt-assessment__taxonomy[data-taxonomy]').evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute('data-taxonomy'))
          .filter((value): value is string => !!value),
      );

      expect(taxonomyValues.length, `expected Bloom chips on ${row.path}`).toBeGreaterThan(0);
      expect(taxonomyValues.every((value) => BLOOM_TAXONOMIES.has(value))).toBeTruthy();

      await page.locator('.nt-assessment__footer .nt-lesson-button--primary').click();
      await expect(page.getByRole('alert')).toHaveText('Answer every question before submitting.', {
        timeout: 10_000,
      });
    });
  }
});

test.describe('learner hub smoke', () => {
  test('unlocked learning path reaches a practical exam pane', async ({ page }) => {
    await seedLearnerSession(page);
    await installAssessmentMocks(page, true);

    const response = await page.goto('/patterns/learn', { waitUntil: 'domcontentloaded' });
    expect(response, 'no response for /patterns/learn').not.toBeNull();
    expect(response!.status(), '/patterns/learn should render').toBe(200);

    await expect(page.getByTestId('student-learning-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Learning Path', { exact: false })).toBeVisible({ timeout: 10_000 });

    const nextButton = page.getByRole('button', { name: /^(Next|Submit exam and continue)$/i });
    const practicalButton = page.getByRole('button', { name: /Practical Exam/i });

    for (let i = 0; i < 120; i += 1) {
      if ((await practicalButton.count()) > 0) break;
      await nextButton.click();
    }

    await expect(practicalButton).toBeVisible({ timeout: 10_000 });
    await practicalButton.click();

    await expect(page.locator('.nt-practical__target')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-practical')).toBeVisible({ timeout: 10_000 });
  });
});
