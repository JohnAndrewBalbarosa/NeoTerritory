import { test, expect, type Page } from '@playwright/test';

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

async function installAssessmentMocks(page: Page, opts: { activePlan?: boolean } = {}): Promise<void> {
  const hasActivePlan = opts.activePlan !== false; // default: pilot learner HAS a plan
  await page.route('**/api/learning/modules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modules: [] }), // falls back to bundled LEARNING_MODULES (incl. pilot forms)
    });
  });

  // Active plan: present for the authenticated pilot learner (two approved pilot
  // modules); ABSENT (plan: null) for a Guest — which is how the formal pre-test
  // stays inaccessible to Guests (NO_ACTIVE_PLAN), with no fallback.
  await page.route('**/api/learning/active-plan', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        hasActivePlan
          ? {
              plan: {
                id: 'pilot-plan-001',
                status: 'active',
                modules: [
                  { moduleId: 'foundations-what-is-pattern', selectionStatus: 'approved', recommendationSource: 'system', displayOrder: 0 },
                  { moduleId: 'creational-builder', selectionStatus: 'approved', recommendationSource: 'system', displayOrder: 1 },
                ],
              },
            }
          : { plan: null },
      ),
    });
  });

  // No prior attempts: a fresh learner has no completed pre-test cycle, so a
  // post-test is correctly cycle-gated.
  await page.route('**/api/learning/assessments', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ attempts: [], answers: [] }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

// Authenticate as a learner (role 'user') — the mocked-backend stand-in for the
// dedicated pilot learner. The pre-test is reachable for an authenticated
// learner WITH an active plan, never for a Guest.
async function seedLearnerSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nt_token', 'pw-test-token');
      localStorage.setItem(
        'nt_user',
        JSON.stringify({
          id: 4101,
          username: 'pilot-learner',
          email: 'pilot-learner@neoterritory.local',
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
  test('Guest (no active plan) cannot access the formal pre-test', async ({ page }) => {
    // No learner session seeded → Guest. Active plan absent → the pre-test is
    // gated with NO_ACTIVE_PLAN and renders zero questions (no fallback).
    await installAssessmentMocks(page, { activePlan: false });

    const response = await page.goto('/pre-test', { waitUntil: 'domcontentloaded' });
    expect(response!.status()).toBe(200);
    await expect(page.locator('[data-testid="pretest-page"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-cycle-error="NO_ACTIVE_PLAN"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-assessment__items > li')).toHaveCount(0);
  });

  test('pilot learner can access /pre-test (10-question Form A from the active plan)', async ({ page }) => {
    await seedLearnerSession(page); // authenticated learner (stands in for the pilot learner)
    await installAssessmentMocks(page);

    const response = await page.goto('/pre-test', { waitUntil: 'domcontentloaded' });
    expect(response, 'no response for /pre-test').not.toBeNull();
    expect(response!.status(), 'bad status for /pre-test').toBe(200);

    await expect(page.locator('[data-testid="pretest-page"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Baseline Assessment: Pre-Test/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-assessment__items > li').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-assessment__choices input[type="radio"]').first()).toBeVisible({ timeout: 10_000 });

    // Bloom taxonomy is internal-only: no taxonomy chips on the learner page.
    await expect(page.locator('.nt-assessment__taxonomy')).toHaveCount(0);

    // Normal paginated test (≈5/page): 2 pilot modules × 5 = 10 questions → 2 pages.
    await expect(page.getByText(/Page 1 of 2/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-assessment__footer .nt-lesson-button--primary')).toBeVisible({ timeout: 10_000 });
  });

  for (const row of ASSESSMENT_ROUTES.filter((r) => r.path !== '/pre-test')) {
    test(`${row.path} is cycle-gated without a completed pre-test`, async ({ page }) => {
      await seedLearnerSession(page);
      await installAssessmentMocks(page);

      const response = await page.goto(row.path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${row.path}`).not.toBeNull();
      expect(response!.status(), `bad status for ${row.path}`).toBe(200);

      await expect(page.locator(`[data-testid="${row.testId}"]`)).toBeVisible({ timeout: 10_000 });
      // No paired pre-test cycle → the post-test is gated (no silent fallback,
      // no Form-A reuse) and shows the explicit gate rather than questions.
      await expect(page.locator('[data-cycle-error="NO_PAIRED_PRETEST"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.nt-assessment__items > li')).toHaveCount(0);
    });
  }
});

test.describe('learner hub smoke', () => {
  test('unlocked learning path reaches a practical exam pane', async ({ page }) => {
    await seedLearnerSession(page);
    await installAssessmentMocks(page);

    const response = await page.goto('/patterns/learn', { waitUntil: 'domcontentloaded' });
    expect(response, 'no response for /patterns/learn').not.toBeNull();
    expect(response!.status(), '/patterns/learn should render').toBe(200);

    await expect(page.getByTestId('student-learning-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Learning Path', { exact: false })).toBeVisible({ timeout: 10_000 });

    // The sidebar is now a category accordion (no page-level drill-down), so
    // the practical pane is reached by stepping through pages with the Next
    // arrow rather than clicking a "Practical Exam" sidebar button.
    const nextButton = page.getByRole('button', { name: /^(Next|Submit exam and continue)$/i });
    const practicalPane = page.locator('.nt-practical');

    for (let i = 0; i < 120; i += 1) {
      if ((await practicalPane.count()) > 0) break;
      await nextButton.click();
    }

    await expect(practicalPane).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-practical__target')).toBeVisible({ timeout: 10_000 });
  });
});
