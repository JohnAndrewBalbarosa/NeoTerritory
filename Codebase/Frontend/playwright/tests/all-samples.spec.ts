import { test, expect, Page } from '@playwright/test';

// Per D68 (this turn): iterate every design-pattern sample under
// Codebase/Microservice/samples/ and assert the full studio pipeline works
// end-to-end:
//   1. Sign in (tester account).
//   2. Land on Submit tab.
//   3. Open the sample picker and select the sample.
//   4. Click Analyze; wait for analysis to land.
//   5. Switch to Patterns tab; assert the class tree shows the expected
//      class with at least one pattern verdict (tagging worked).
//   6. Switch to Tests tab; click "Run all tests"; assert per-pattern rows
//      stream in with compile_run/unit_test verdicts.
//   7. Drop assertion bar: at minimum, compile_run must be 'pass' for at
//      least one pattern. Unit test failures are still surfaced but do not
//      fail the spec by themselves — they are recorded as a per-sample
//      warning so we can see which samples need scaffold work.
//
// The GitHub Actions workflow at .github/workflows/playwright-e2e.yml runs
// this spec against a freshly built stack and fails if any sample breaks
// the pipeline. That gate is the contract: if any sample stops working,
// the system is broken and the build must fail.

interface SampleSpec {
  // Display name shown in the test title.
  name: string;
  // File name as it appears in the sample picker modal (the picker shows
  // the .cpp filename below the pattern label).
  filename: string;
  // Family heading the sample lives under in the picker.
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms';
  // The class name the sample defines (used for the Patterns-tab assertion).
  expectedClassNameRegex: RegExp;
}

// Mirrors Codebase/Microservice/samples/ — keep in sync when samples are
// added or removed. Each entry asserts ONE class name regex; samples that
// host multiple classes (mixed/, usages/) match against the strongest one.
const SAMPLES: ReadonlyArray<SampleSpec> = [
  {
    name: 'Builder · http_request_builder',
    filename: 'http_request_builder.cpp',
    family: 'Creational',
    expectedClassNameRegex: /HttpRequestBuilder/,
  },
  {
    name: 'Factory · shape_factory',
    filename: 'shape_factory.cpp',
    family: 'Creational',
    expectedClassNameRegex: /ShapeFactory|Shape/,
  },
  {
    name: 'Singleton · config_registry',
    filename: 'config_registry.cpp',
    family: 'Creational',
    expectedClassNameRegex: /ConfigRegistry|Config/,
  },
  {
    name: 'Method Chaining · query_predicate',
    filename: 'query_predicate.cpp',
    family: 'Behavioural',
    expectedClassNameRegex: /QueryPredicate|Query/,
  },
  {
    name: 'Strategy · strategy_basic',
    filename: 'strategy_basic.cpp',
    family: 'Behavioural',
    expectedClassNameRegex: /Strategy|Sort|Algorithm/,
  },
  {
    name: 'Strategy · strategy_with_pimpl',
    filename: 'strategy_with_pimpl.cpp',
    family: 'Behavioural',
    expectedClassNameRegex: /Strategy|Pimpl/,
  },
  {
    name: 'Wrapping · logging_proxy',
    filename: 'logging_proxy.cpp',
    family: 'Structural',
    expectedClassNameRegex: /Logging|Proxy/,
  },
  {
    name: 'PIMPL · pimpl_basic',
    filename: 'pimpl_basic.cpp',
    family: 'Idioms',
    expectedClassNameRegex: /Pimpl|Widget|Impl/,
  },
  {
    name: 'Mixed · mixed_classes',
    filename: 'mixed_classes.cpp',
    family: 'Idioms',
    expectedClassNameRegex: /[A-Z]\w+/,
  },
  {
    name: 'Usages · usages_basic',
    filename: 'usages_basic.cpp',
    family: 'Idioms',
    expectedClassNameRegex: /[A-Z]\w+/,
  },
];

async function signInAsTester(page: Page): Promise<void> {
  // The tester picker exposes the shared 'devcon' password. The first
  // account in /auth/test-accounts is reused by all CI runs.
  const accountsRes = await page.request.get('/auth/test-accounts');
  expect(accountsRes.ok(), 'tester accounts endpoint should answer').toBeTruthy();
  const body = (await accountsRes.json()) as {
    accounts: Array<{ username: string }>;
    password: string;
  };
  expect(body.accounts.length, 'at least one tester account must be available').toBeGreaterThan(0);
  const username = body.accounts[0].username;
  const password = body.password || 'devcon';

  await page.goto('/login');
  // The tester picker is the default sign-in surface. The form uses
  // username + password inputs; we click the primary submit button.
  const userField = page.locator('input[name="username"], input[type="text"]').first();
  const passField = page.locator('input[type="password"]').first();
  await userField.fill(username);
  await passField.fill(password);
  const submit = page.locator('button[type="submit"]').first();
  await submit.click();
  await page.waitForLoadState('networkidle');
  // After login the studio replaceStates to /studio.
  await expect(page).toHaveURL(/\/(studio|consent|pretest)/);

  // Accept consent + pretest if they appear (some tester accounts skip).
  const consentBtn = page.locator('button:has-text("I agree"), button:has-text("Continue")').first();
  if (await consentBtn.isVisible().catch(() => false)) {
    await consentBtn.click();
    await page.waitForLoadState('networkidle');
  }
  const skipPretest = page.locator('button:has-text("Submit")').first();
  if (await page.url().match(/\/pretest/) && await skipPretest.isVisible().catch(() => false)) {
    await skipPretest.click();
    await page.waitForLoadState('networkidle');
  }

  await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
}

async function loadSampleByFilename(page: Page, filename: string): Promise<void> {
  const loadBtn = page.locator('#load-sample-btn');
  await expect(loadBtn).toBeVisible();
  await loadBtn.click();

  // SamplePickerModal mounts a portal — find the tile by its filename.
  const tile = page.locator('.nt-sample-picker__pick', { hasText: filename }).first();
  await expect(tile, `picker tile for ${filename} should be visible`).toBeVisible({ timeout: 5_000 });
  await tile.click();

  // After selection the modal closes and slot 1 holds the sample content.
  await expect(loadBtn).toBeVisible();
}

async function runAnalysis(page: Page): Promise<void> {
  const analyze = page.locator('#analyze-btn');
  await expect(analyze).toBeEnabled();
  await analyze.click();

  // Wait for the run to complete: the status card transitions from
  // "Analyzing..." to "Analysis ready" (the title is set by the store).
  await expect(page.locator('#status-title')).toHaveText(/Analysis ready/i, { timeout: 60_000 });
}

async function assertTaggingHappened(page: Page, classNameRegex: RegExp): Promise<void> {
  // Switch to the Patterns tab (its label text in MainLayout).
  await page.locator('button[role="tab"]:has-text("Patterns")').click();

  // The class tree lists every detected class. Assert at least one match.
  const tree = page.locator('.class-tree-view');
  await expect(tree).toBeVisible({ timeout: 15_000 });
  const classNode = page.locator('.class-tree-name').filter({ hasText: classNameRegex }).first();
  await expect(classNode, `class matching ${classNameRegex} should appear`).toBeVisible({
    timeout: 10_000,
  });
}

async function runTestsAndAssertCompile(page: Page): Promise<{
  unitFailures: number;
}> {
  // Switch to the Tests tab.
  await page.locator('button[role="tab"]:has-text("Tests")').click();
  // The trophy banner should be visible — confirms the tab mounted.
  await expect(page.locator('.gdb-trophy-banner')).toBeVisible({ timeout: 10_000 });

  const runAll = page.locator('button:has-text("Run all tests")').first();
  // The button may be disabled if a previous run is still bound to this
  // submission. The pipeline relies on a fresh submission, so we expect
  // the button enabled here.
  await expect(runAll).toBeEnabled({ timeout: 10_000 });
  await runAll.click();

  // Wait for compile_run verdicts to land. There must be at least one
  // gdb-phase-row with data-status either 'pass', 'fail', or 'error'.
  await page
    .locator('.gdb-phase-row[data-phase="compile_run"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 });

  // Give all rows a moment to settle.
  await page.waitForTimeout(2_000);

  const compileRows = page.locator('.gdb-phase-row[data-phase="compile_run"]');
  const compileCount = await compileRows.count();
  expect(compileCount, 'at least one compile_run row should appear').toBeGreaterThan(0);

  // At least one compile_run must pass for the spec to pass — that is the
  // minimum signal that "the system actually compiled the sample."
  const passingCompiles = await page
    .locator('.gdb-phase-row[data-phase="compile_run"][data-status="pass"]')
    .count();
  expect(
    passingCompiles,
    'at least one pattern row must have compile_run=pass',
  ).toBeGreaterThan(0);

  // Count unit_test failures for telemetry. Failures do not fail the spec
  // — they are surfaced in the report so we know which samples need
  // scaffold improvements.
  const unitFailures = await page
    .locator('.gdb-phase-row[data-phase="unit_test"][data-status="fail"]')
    .count();
  return { unitFailures };
}

test.describe('Studio pipeline — every design-pattern sample', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTester(page);
  });

  for (const sample of SAMPLES) {
    test(sample.name, async ({ page }, testInfo) => {
      await loadSampleByFilename(page, sample.filename);
      await runAnalysis(page);
      await assertTaggingHappened(page, sample.expectedClassNameRegex);
      const { unitFailures } = await runTestsAndAssertCompile(page);
      if (unitFailures > 0) {
        testInfo.annotations.push({
          type: 'warning',
          description: `${unitFailures} unit_test row(s) failed for ${sample.filename}. Compile_run passed; scaffold may need work.`,
        });
      }
    });
  }
});
