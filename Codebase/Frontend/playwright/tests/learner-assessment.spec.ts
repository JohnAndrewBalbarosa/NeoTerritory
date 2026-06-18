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

async function installAssessmentMocks(
  page: Page,
  includeLearnerSession = false,
  initialPretestComplete = false,
): Promise<{
  savedAssessmentAnswers: () => unknown[];
}> {
  let persistedAnswers: unknown[] = [];
  if (includeLearnerSession) {
    await page.route('**/auth/heartbeat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  }
  const publishedModules = LEARNING_MODULES.filter((module) =>
    DEFAULT_PUBLISHED_LEARNING_MODULE_IDS.has(module.id)
  );
  if (initialPretestComplete && publishedModules[0]) {
    persistedAnswers = [{
      moduleId: publishedModules[0].id,
      questionIndex: 0,
      selectedIndex: -1,
      responseText: null,
      questionTaxonomy: 'remembering',
    }];
  }
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
        body: JSON.stringify(persistedAnswers.length > 0 ? {
          attempts: [{
            id: 1,
            assessmentType: 'pretest',
            sessionId: 'pw-session',
            questionCount: persistedAnswers.length,
            correctCount: 0,
            scorePercent: 0,
            createdAt: '2026-06-18T00:00:00.000Z',
          }],
          answers: persistedAnswers.map((answer: any, index) => ({
            id: index + 1,
            attemptId: 1,
            assessmentType: 'pretest',
            assessmentIndex: index,
            moduleId: answer.moduleId,
            questionIndex: answer.questionIndex,
            selectedIndex: answer.selectedIndex,
            responseText: answer.responseText ?? null,
            questionTaxonomy: answer.questionTaxonomy,
            questionKind: 'theoretical',
            isCorrect: false,
            sessionId: 'pw-session',
            createdAt: '2026-06-18T00:00:00.000Z',
          })),
        } : { attempts: [], answers: [] }),
      });
      return;
    }
    const payload = route.request().postDataJSON() as { answers?: unknown[] };
    persistedAnswers = payload.answers ?? [];
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

  await page.route('**/api/learning/progress', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          completedModuleIds: [],
          lastUnlockedModuleId: null,
          theoryPassedModuleIds: [],
          bloomMasteryByModule: {},
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return { savedAssessmentAnswers: () => persistedAnswers };
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

  test('pre-test completes all six Bloom levels, shows a summary, and opens the learner path', async ({ page }) => {
    await seedLearnerSession(page);
    const mocks = await installAssessmentMocks(page, true);
    await page.goto('/pre-test?next=%2Fpatterns%2Flearn', { waitUntil: 'domcontentloaded' });

    for (let level = 1; level <= 6; level += 1) {
      await expect(page.locator('.nt-assessment__items > li')).toHaveCount(25);
      await page.getByRole('button', { name: 'Submit Level' }).click();
      if (level < 6) {
        await expect(page.locator('.nt-assessment__score strong')).toHaveText('0/25');
        await page.getByRole('button', { name: 'Proceed to Next Level' }).click();
        await expect(page.locator('.nt-test-page__panel-kicker')).toContainText(`Level ${level + 1}:`);
      } else {
        await expect(page.getByTestId('pretest-score-summary')).toBeVisible();
      }
    }

    await expect(page.getByTestId('pretest-score-summary')).toBeVisible();
    await expect(page.getByTestId('pretest-score-summary').locator('li')).toHaveCount(6);
    expect(mocks.savedAssessmentAnswers()).toHaveLength(150);

    await page.getByRole('button', { name: 'Continue to Learning Path' }).click();
    await expect(page).toHaveURL(/\/patterns\/learn$/);
    await expect(page.getByTestId('student-learning-shell')).toBeVisible();
  });
});

test.describe('learner hub smoke', () => {
  test('fresh pre-test history opens the personalized learning path', async ({ page }) => {
    await seedLearnerSession(page);
    await installAssessmentMocks(page, true, true);

    const response = await page.goto('/patterns/learn', { waitUntil: 'domcontentloaded' });
    expect(response, 'no response for /patterns/learn').not.toBeNull();
    expect(response!.status(), '/patterns/learn should render').toBe(200);

    await expect(page.getByTestId('student-learning-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Learning Path' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-course-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.nt-course-sidebar')).toContainText('What is a design pattern?');
  });
});
