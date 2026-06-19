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

async function seedPersistentLearnerSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('nt_token', 'pw-learning-token');
    localStorage.setItem(
      'nt_user',
      JSON.stringify({
        id: 4201,
        username: 'pw-learning-user',
        email: 'pw-learning@example.com',
        role: 'user',
      }),
    );
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
  test('Intern Dashboard shows Pre-Test standing and keeps Studio locked until the Post-Test', async ({ page }) => {
    await seedPersistentLearnerSession(page);

    const form = (moduleId: string, formId: 'A' | 'B') => Array.from({ length: 5 }, (_, index) => ({
      id: `${moduleId}:${formId}${index + 1}`,
      type: 'mcq',
      question: `${moduleId} ${formId} question ${index + 1}`,
      options: ['Correct', 'Wrong'],
      correctIndex: 0,
      taxonomy: ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating'][index],
    }));
    const modules = ['module-a', 'module-b'].map((id, index) => ({
      id,
      category: index === 0 ? 'foundations' : 'creational',
      title: index === 0 ? 'Module A' : 'Module B',
      eyebrow: index === 0 ? 'Foundations' : 'Creational',
      intro: `${id} content`,
      sections: [],
      assessmentForms: { A: form(id, 'A'), B: form(id, 'B') },
      theoreticalExam: { kind: 'theoretical', questions: form(id, 'A') },
    }));
    let includePosttest = false;
    const createdAt = new Date().toISOString();
    const attempt = (id: number, assessmentType: 'pretest' | 'posttest') => ({
      id,
      assessmentType,
      sessionId: null,
      questionCount: 10,
      cycleId: 'cycle-dashboard',
      createdAt,
    });
    const answersFor = (attemptId: number, assessmentType: 'pretest' | 'posttest', formId: 'A' | 'B') =>
      modules.flatMap((module, moduleIndex) =>
        form(module.id, formId).map((question, questionIndex) => ({
          id: attemptId * 100 + moduleIndex * 10 + questionIndex,
          attemptId,
          assessmentType,
          assessmentIndex: moduleIndex * 5 + questionIndex,
          moduleId: module.id,
          questionIndex,
          questionId: question.id,
          selectedIndex:
            assessmentType === 'pretest' && module.id === 'module-b' && questionIndex < 2 ? 1 : 0,
          responseText: null,
          questionTaxonomy: question.taxonomy,
          questionKind: 'theoretical',
          sessionId: null,
          createdAt,
        })),
      );

    await page.route('**/api/learning/modules', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modules }),
    }));
    await page.route('**/api/learning/progress', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        completedModuleIds: ['module-a', 'module-b'],
        lastUnlockedModuleId: 'module-b',
        theoryPassedModuleIds: ['module-a', 'module-b'],
        bloomMasteryByModule: { 'module-a': 6, 'module-b': 6 },
      }),
    }));
    await page.route('**/api/learning/assessments', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        attempts: [attempt(1, 'pretest'), ...(includePosttest ? [attempt(2, 'posttest')] : [])],
        answers: [
          ...answersFor(1, 'pretest', 'A'),
          ...(includePosttest ? answersFor(2, 'posttest', 'B') : []),
        ],
        courseUpdatedAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    }));
    await page.route('**/api/health', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        service: 'qa',
        totalRuns: 0,
        aiProviderConfigured: false,
        microservice: { connected: true, binaryFound: true, catalogFound: true },
      }),
    }));
    await page.route('**/api/runs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/sample', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

    await page.goto('/intern-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Intern Dashboard', { exact: true })).toBeVisible();
    await expect(page.getByText('Pre-Test standing', { exact: true })).toBeVisible();
    await expect(page.getByText('5 of 7 correct. 1 module(s) required for study.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take Post-Test', exact: true })).toBeVisible();

    await page.goto('/studio', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('studio-learning-gate')).toBeVisible();

    includePosttest = true;
    await page.goto('/intern-dashboard', { waitUntil: 'domcontentloaded' });
    const openStudio = page.getByRole('button', { name: 'Open Studio', exact: true });
    await expect(openStudio).toBeVisible();
    await openStudio.click();
    await expect(page.getByText('CodiNeo Studio', { exact: true })).toBeVisible();
  });

  test('conceptual assessment records score, blocks duplicate answers, and unlocks only on perfect', async ({ page }) => {
    await seedPersistentLearnerSession(page);

    const taxonomies = [
      'remembering',
      'understanding',
      'applying',
      'analyzing',
      'evaluating',
      'creating',
    ] as const;
    const buildQuestions = (prefix: string) => taxonomies.map((taxonomy, index) => ({
      type: 'mcq',
      question: `${prefix} question ${index + 1}`,
      options: [`${prefix} correct ${index + 1}`, `${prefix} wrong ${index + 1}`],
      correctIndex: 0,
      taxonomy,
    }));
    const modules = [
      {
        id: 'foundation-gate',
        category: 'foundations',
        title: 'Foundation Gate',
        eyebrow: 'Foundations',
        intro: 'Foundation content.',
        sections: [{ heading: 'Foundation', body: 'Foundation review.' }],
        theoreticalExam: { kind: 'theoretical', questions: buildQuestions('Foundation') },
      },
      {
        id: 'concept-target',
        category: 'creational',
        title: 'Concept Target',
        eyebrow: 'Creational',
        intro: 'Concept content.',
        sections: [{ heading: 'Concept', body: 'Review before submitting.' }],
        theoreticalExam: { kind: 'theoretical', questions: buildQuestions('Target') },
      },
      {
        id: 'locked-next',
        category: 'structural',
        title: 'Locked Next',
        eyebrow: 'Structural',
        intro: 'Next content.',
        sections: [{ heading: 'Next', body: 'Unlocked after a perfect score.' }],
        theoreticalExam: { kind: 'theoretical', questions: buildQuestions('Next') },
      },
    ];
    const submittedAttempts: Array<unknown> = [];
    const progressUpdates: Array<unknown> = [];
    const createdAt = new Date().toISOString();
    const courseUpdatedAt = new Date(Date.now() - 1_000).toISOString();

    await page.route('**/api/learning/modules', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modules }),
      });
    });
    await page.route('**/api/learning/assessments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempts: [{
            id: 1,
            assessmentType: 'pretest',
            sessionId: null,
            questionCount: 6,
            createdAt,
          }],
          answers: taxonomies.map((taxonomy, index) => ({
            id: index + 1,
            attemptId: 1,
            assessmentType: 'pretest',
            assessmentIndex: index,
            moduleId: 'foundation-gate',
            questionIndex: index,
            selectedIndex: 0,
            responseText: '',
            questionTaxonomy: taxonomy,
            questionKind: 'theoretical',
            sessionId: null,
            createdAt,
          })),
          courseUpdatedAt,
        }),
      });
    });
    await page.route('**/api/learning/progress', async (route) => {
      if (route.request().method() === 'PUT') {
        progressUpdates.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          completedModuleIds: ['foundation-gate'],
          lastUnlockedModuleId: 'concept-target',
          triesByModule: {},
          theoryPassedModuleIds: ['foundation-gate'],
          bloomMasteryByModule: { 'foundation-gate': 6 },
        }),
      });
    });
    await page.route('**/api/learning/answers', async (route) => {
      submittedAttempts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, recorded: 6 }),
      });
    });

    await page.goto('/patterns/learn', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.nt-course-shell')).toBeVisible();
    await page.locator('.nt-course-accordion__cat').filter({ hasText: 'FOUNDATIONS' }).click();
    await expect(page.locator('.nt-course-accordion__module[data-status="done"] svg')).toHaveCount(1);
    await page.locator('.nt-course-accordion__cat').filter({ hasText: 'STRUCTURAL' }).click();
    await expect(page.locator('.nt-course-accordion__module[data-status="locked"] svg')).toHaveCount(1);
    await page.locator('.nt-course-accordion__cat').filter({ hasText: 'CREATIONAL' }).click();

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    const submit = page.getByRole('button', { name: 'Submit', exact: true });
    await expect(submit).toBeDisabled();

    const questions = page.locator('.nt-exam__question');
    await expect(questions).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      const choices = questions.nth(index).locator('input[type="radio"]');
      await expect(choices).toHaveCount(2);
      await choices.nth(index === 0 ? 1 : 0).check();
    }

    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('Score: 5 / 6', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Review this module and try again before proceeding.', { exact: true }),
    ).toBeVisible();
    expect(submittedAttempts).toHaveLength(1);
    expect(progressUpdates).toHaveLength(0);

    await page.getByRole('button', { name: 'Revise Answers', exact: true }).click();
    await expect(submit).toBeDisabled();
    await questions.nth(0).locator('input[type="radio"]').nth(0).check();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText('Score: 6 / 6', { exact: true })).toBeVisible();
    await expect(page.getByText('Perfect score. You may proceed to the next module.', { exact: true })).toBeVisible();
    expect(submittedAttempts).toHaveLength(2);
    expect(progressUpdates).toHaveLength(1);
  });

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
