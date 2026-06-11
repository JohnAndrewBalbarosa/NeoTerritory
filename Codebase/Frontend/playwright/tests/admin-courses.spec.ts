import { test, expect, type Page } from '@playwright/test';

const LEGACY_ADMIN_USERNAME = 'Neoterritory';
const LEGACY_ADMIN_PASSWORD = 'ragabag123';

const COURSE_PROMPT =
  'Plan a course path for a product team. Keep Repository, State, and Strategy on, and keep foundations required.';
const ADMIN_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';

const mockLearningModules = [
  {
    id: 'idioms-repository',
    category: 'idioms',
    title: 'Repository',
    eyebrow: 'Idioms · Repository',
    intro: 'Repository keeps data access behind a collection-like interface.',
    sections: [],
    published: false,
    autoTag: true,
    sortOrder: 10,
    isSeed: true,
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
  {
    id: 'behavioural-state',
    category: 'behavioural',
    title: 'State',
    eyebrow: 'Behavioural · State',
    intro: 'State lets an object change behaviour when its internal state changes.',
    sections: [],
    published: false,
    autoTag: true,
    sortOrder: 20,
    isSeed: true,
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
  {
    id: 'behavioural-strategy',
    category: 'behavioural',
    title: 'Strategy',
    eyebrow: 'Behavioural · Strategy',
    intro: 'Strategy encapsulates interchangeable algorithms behind one interface.',
    sections: [],
    published: false,
    autoTag: true,
    sortOrder: 30,
    isSeed: true,
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
] as const;

const mockCoursePlan = {
  schemaVersion: 'course-plan-v1',
  source: 'ai',
  summary: 'AI preview selected three non-foundation modules and kept the required foundations separate.',
  sections: [
    {
      sectionId: 'idioms',
      section: 'Idioms',
      modules: [
        {
          moduleId: 'idioms-repository',
          title: 'Repository',
          category: 'idioms',
          published: true,
          reason: 'Repository is selected for data-access architecture coverage.',
          matchedSections: ['Repository'],
          matchedTopics: ['collection-like interface'],
        },
      ],
    },
    {
      sectionId: 'behavioural',
      section: 'Behavioural',
      modules: [
        {
          moduleId: 'behavioural-state',
          title: 'State',
          category: 'behavioural',
          published: true,
          reason: 'State is selected for runtime behaviour transitions.',
          matchedSections: ['State'],
          matchedTopics: ['state transition', 'delegation'],
        },
        {
          moduleId: 'behavioural-strategy',
          title: 'Strategy',
          category: 'behavioural',
          published: true,
          reason: 'Strategy is selected for interchangeable algorithms.',
          matchedSections: ['Strategy'],
          matchedTopics: ['polymorphic interface', 'runtime swap'],
        },
      ],
    },
  ],
  modules: [
    {
      moduleId: 'idioms-repository',
      title: 'Repository',
      category: 'idioms',
      published: true,
      reason: 'Repository is selected for data-access architecture coverage.',
      matchedSections: ['Repository'],
      matchedTopics: ['collection-like interface'],
    },
    {
      moduleId: 'behavioural-state',
      title: 'State',
      category: 'behavioural',
      published: true,
      reason: 'State is selected for runtime behaviour transitions.',
      matchedSections: ['State'],
      matchedTopics: ['state transition', 'delegation'],
    },
    {
      moduleId: 'behavioural-strategy',
      title: 'Strategy',
      category: 'behavioural',
      published: true,
      reason: 'Strategy is selected for interchangeable algorithms.',
      matchedSections: ['Strategy'],
      matchedTopics: ['polymorphic interface', 'runtime swap'],
    },
  ],
  requiredLearning: [
    {
      moduleId: 'foundations-interface-principle',
      title: 'Program to an interface',
      category: 'foundations',
      sections: ['Principle'],
      topics: ['required', 'interfaces'],
      reason: 'Foundations are required before the AI-selected modules.',
    },
  ],
  diagnostics: {
    aiAttempted: true,
    aiSucceeded: true,
    catalogModuleCount: 3,
    selectedSectionCount: 2,
    selectedModuleCount: 3,
    emptyPlan: false,
    message: 'AI returned a valid JSON course plan.',
    aiValidation: {
      status: 'passed',
      mode: 'sections',
      issues: [],
      acceptedModuleIds: ['idioms-repository', 'behavioural-state', 'behavioural-strategy'],
    },
    patternDiversity: {
      selectedSlugs: ['repository', 'state', 'strategy'],
      selectedFamilies: { Idioms: 1, Behavioural: 2 },
      diversityScore: 70,
      adapter: {
        selected: false,
        score: 0,
        matchedEvidence: [],
        avoidedEvidence: ['avoided:Facade'],
      },
    },
    patternAudit: [
      {
        slug: 'repository',
        name: 'Repository',
        family: 'Idioms',
        score: 98,
        selected: true,
        matchedEvidence: ['data-access', 'collection-like interface'],
      },
      {
        slug: 'state',
        name: 'State',
        family: 'Behavioural',
        score: 97,
        selected: true,
        matchedEvidence: ['state transition', 'self-swap'],
      },
      {
        slug: 'strategy',
        name: 'Strategy',
        family: 'Behavioural',
        score: 96,
        selected: true,
        matchedEvidence: ['interchangeable algorithms', 'client injection'],
      },
    ],
  },
} as const;

const emptyRegression = {
  slope: 0,
  intercept: 0,
  r2: 0,
  n: 0,
  interpretation: 'No saved runs in test fixture.',
};

function mockAdminBody(urlText: string): unknown {
  const url = new URL(urlText);
  const path = url.pathname;

  if (path.endsWith('/stats/overview')) {
    return { totalUsers: 0, totalRuns: 0, runsToday: 0, totalReviews: 0, avgFindings: 0 };
  }
  if (path.endsWith('/stats/runs-per-day') || path.endsWith('/stats/pattern-frequency') || path.endsWith('/stats/per-user-activity')) {
    return { series: [] };
  }
  if (path.endsWith('/stats/test-summary')) {
    return {
      runs: 0,
      runsWithTests: 0,
      compile: { total: 0, passed: 0, failed: 0, passRate: 0, avgMs: 0 },
      staticAnalysis: { total: 0, passed: 0, failed: 0, passRate: 0, avgFindings: 0, avgMs: 0 },
      unitTests: { totalCases: 0, passedCases: 0, failedCases: 0, passRate: 0, totalClasses: 0, avgCasesPerClass: 0 },
      note: 'Test fixture.',
    };
  }
  if (path.endsWith('/stats/complexity-data')) {
    return {
      points: [],
      regression: emptyRegression,
      regressionByItems: emptyRegression,
      regressionSpaceByTokens: emptyRegression,
      regressionSpaceKbByTokens: emptyRegression,
      regressionWallUsByTokens: emptyRegression,
      regressionWallUsByTokensTrimmed: emptyRegression,
    };
  }
  if (path.endsWith('/stats/cronbach')) {
    return { subscales: [], totalRespondents: 0, methodologyNote: 'Test fixture.' };
  }
  if (path.endsWith('/stats/f1-metrics')) {
    const emptyScore = { precision: 0, recall: 0, f1: 0, tp: 0, fp: 0, fn: 0, tn: 0, accuracy: 0 };
    return { overall: emptyScore, perPattern: [], userAccuracyAvg: null, likertF1Correlation: null, totalRuns: 0, note: 'Test fixture.' };
  }
  if (path.endsWith('/stats/survey-summary')) {
    return { perRun: {}, endOfSession: {} };
  }
  if (path.endsWith('/stats/per-run-feedback') || path.endsWith('/stats/per-session-feedback') || path.endsWith('/stats/open-ended')) {
    return { rows: [] };
  }
  if (path.endsWith('/stats/learning-raw')) {
    return { students: [], progress: [], questionResults: [], examAttempts: [] };
  }
  if (path.endsWith('/stats/learning-questions')) {
    return { questions: [] };
  }
  if (path.endsWith('/runs')) {
    return { runs: [] };
  }
  if (path.endsWith('/users')) {
    return {
      users: [
        {
          id: 2,
          username: 'tester-01',
          email: 'tester-01@example.com',
          role: 'user',
          last_active: '2026-06-11T08:45:00',
          created_via: 'legacy',
        },
      ],
    };
  }
  if (path.endsWith('/settings')) {
    return {
      testers_visible_to_users: true,
      reviews_required: true,
      feature_releases: {},
      f1_norm_profile: {
        label: 'Test fixture',
        participantCount: 0,
        recallOnAnalyzerPositive: 0,
        specificityOnAnalyzerNegative: 0,
        hallucinatePatternRate: 0,
      },
    };
  }
  if (path.endsWith('/ai-config')) {
    return { provider: 'none', model: '', hasKey: false, updatedAt: null, updatedBy: null };
  }
  if (path.endsWith('/reviews')) {
    return { reviews: [] };
  }
  if (path.endsWith('/logs')) {
    return { logs: [] };
  }
  if (path.endsWith('/audit')) {
    return { entries: [] };
  }
  if (path.endsWith('/pattern-groups')) {
    return { groups: [] };
  }
  return {};
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: doc.scrollWidth,
      bodyScrollWidth: body ? body.scrollWidth : 0,
    };
  });

  expect(overflow.docScrollWidth, `document overflowed horizontally on ${label}`).toBeLessThanOrEqual(
    overflow.innerWidth + 1,
  );
  expect(overflow.bodyScrollWidth, `body overflowed horizontally on ${label}`).toBeLessThanOrEqual(
    overflow.innerWidth + 1,
  );
}

async function signInWithLegacyAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('nt_token');
    localStorage.removeItem('nt_user');
    sessionStorage.clear();
  });

  const response = await page.goto(new URL('/admin.html', ADMIN_BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  expect(response, 'no response for /admin.html').not.toBeNull();
  expect(response!.status(), '/admin.html should render').toBe(200);
  await expect(page.getByTestId('admin-login-shell')).toBeVisible({ timeout: 10_000 });

  const legacySignIn = page.locator('details.admin-login-legacy');
  await legacySignIn.locator('summary').click();
  await expect(legacySignIn).toHaveAttribute('open', '');

  await legacySignIn.getByLabel('Username').fill(LEGACY_ADMIN_USERNAME);
  await legacySignIn.getByLabel('Password').fill(LEGACY_ADMIN_PASSWORD);
  await legacySignIn.getByRole('button', { name: /sign in with username\/password/i }).click();

  await expect(page.getByTestId('admin-tab-bar')).toBeVisible({ timeout: 15_000 });
}

test.describe('admin courses planner', () => {
  test('renders the AI preview, required modules, and overflow-safe board', async ({ page }) => {
    await page.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/admin/learning/modules') || url.includes('/api/admin/course-plan')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdminBody(url)),
      });
    });

    await page.route('**/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false }),
      });
    });

    await page.route('**/auth/invite-code/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ codes: [] }),
      });
    });

    await page.route('**/auth/join-request/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requests: [] }),
      });
    });

    await page.route('**/auth/login', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as { username?: string; password?: string } | null;
      expect(body).toMatchObject({
        username: LEGACY_ADMIN_USERNAME,
        password: LEGACY_ADMIN_PASSWORD,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'legacy-admin-token',
          user: {
            id: 1,
            username: LEGACY_ADMIN_USERNAME,
            email: 'neoterritory@example.com',
            role: 'admin',
            isOriginalDevs: true,
          },
        }),
      });
    });

    await page.route('**/api/health', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          service: 'frontend',
          totalRuns: 0,
          aiProviderConfigured: true,
          aiProvider: 'anthropic',
          aiModel: 'test-model',
          microservice: {
            connected: true,
            binaryFound: true,
            catalogFound: true,
          },
          docker: {
            enabled: false,
            imageReady: false,
            livePods: 0,
            reason: 'env_off',
            mine: false,
          },
        }),
      });
    });

    await page.route('**/api/admin/users', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              id: 2,
              username: 'tester-01',
              email: 'tester-01@example.com',
              role: 'user',
              last_active: '2026-06-11T08:45:00',
              created_via: 'legacy',
            },
          ],
        }),
      });
    });

    await page.route('**/api/admin/learning/modules', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modules: mockLearningModules }),
      });
    });

    await page.route('**/api/admin/course-plan', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as { prompt?: string } | null;
      expect(body?.prompt?.trim()).toBe(COURSE_PROMPT);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCoursePlan),
      });
    });

    await signInWithLegacyAdmin(page);

    await page.getByRole('button', { name: /Instructor/ }).click();
    await page.getByRole('button', { name: 'Courses' }).click();

    await expect(page.getByTestId('admin-courses')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('course-plan-panel')).toBeVisible({ timeout: 10_000 });

    const prompt = page.getByLabel('Course Prompt');
    await prompt.fill(COURSE_PROMPT);
    await page.getByRole('button', { name: 'Send prompt' }).click();

    const diagnostics = page.getByTestId('course-plan-verification-strip');
    await expect(diagnostics).toBeVisible({ timeout: 10_000 });
    await expect(diagnostics).toContainText('Verified', { timeout: 10_000 });
    await expect(diagnostics).toContainText('validation passed', { timeout: 10_000 });
    await expect(diagnostics).toContainText('diversity 70', { timeout: 10_000 });

    const board = page.getByTestId('course-plan-ai-enabled-board');
    await expect(board).toBeVisible();
    await expect(board.getByText('Repository', { exact: true })).toBeVisible();
    await expect(board.getByText('State', { exact: true })).toBeVisible();
    await expect(board.getByText('Strategy', { exact: true })).toBeVisible();
    await expect(board.getByText('Program to an interface', { exact: false })).toHaveCount(0);
    await expect(board.getByText('baseline', { exact: false })).toHaveCount(0);

    const required = page.getByTestId('course-plan-required-modules');
    await expect(required).toBeVisible();
    await expect(required.getByText('Program to an interface', { exact: false })).toBeVisible();
    await expect(required.getByTestId('course-plan-required-badge')).toContainText('required');
    await expect(required.getByText('baseline', { exact: false })).toHaveCount(0);

    await expectNoHorizontalOverflow(page, 'admin courses desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('admin-courses')).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page, 'admin courses mobile viewport');
  });
});
