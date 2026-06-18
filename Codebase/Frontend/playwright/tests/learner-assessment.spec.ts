import { test, expect, type Page } from '@playwright/test';
import {
  DEFAULT_PUBLISHED_LEARNING_MODULE_IDS,
  LEARNING_MODULES,
} from '../../src/data/learningModules';

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
  const publishedModules = LEARNING_MODULES.filter((module) =>
    DEFAULT_PUBLISHED_LEARNING_MODULE_IDS.has(module.id)
  );
  await page.route('**/api/learning/modules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modules: publishedModules }),
    });
  });

  await page.route('**/api/learning/assessments/grade', async (route) => {
    const payload = route.request().postDataJSON() as {
      answers?: Array<{ moduleId: string; questionIndex: number; selectedIndex: number }>;
    };
    const answers = payload.answers ?? [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        correctCount: 0,
        totalCount: answers.length,
        scorePercent: 0,
        results: answers.map((answer, assessmentIndex) => ({
          ...answer,
          assessmentIndex,
          responseText: '',
          questionTaxonomy: '',
          questionKind: 'theoretical',
          isCorrect: false,
        })),
      }),
    });
  });

  await page.route('**/api/learning/assessments', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ attempts: [], answers: [] }),
      });
      return;
    }
    const payload = route.request().postDataJSON() as { answers?: unknown[] };
    const totalCount = payload.answers?.length ?? 0;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        recorded: totalCount,
        attemptId: 1,
        correctCount: 0,
        totalCount,
        scorePercent: 0,
        results: [],
      }),
    });
  });
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
      await expect(page.locator('.nt-bloom-question input, .nt-bloom-question button').first()).toBeVisible({ timeout: 10_000 });

      const taxonomyValues = await page.locator('.nt-assessment__taxonomy[data-taxonomy]').evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute('data-taxonomy'))
          .filter((value): value is string => !!value),
      );

      expect(taxonomyValues, `expected 25 Bloom chips on ${row.path}`).toHaveLength(25);
      expect(taxonomyValues.every((value) => BLOOM_TAXONOMIES.has(value))).toBeTruthy();

      await page.locator('.nt-assessment__footer .nt-lesson-button--primary').click();
      await expect(page.locator('.nt-assessment__score strong')).toHaveText('0/25', { timeout: 10_000 });
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
