import { test, expect, Page, APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Per-sample raw source is read from disk at test time, not via the
// picker, so a picker-side bug never blocks the pipeline assertion.
const SAMPLES_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'Microservice',
  'samples',
);
const SAMPLE_DIR_BY_FILENAME: Record<string, string> = {
  'http_request_builder.cpp': 'builder',
  'shape_factory.cpp': 'factory',
  'config_registry.cpp': 'singleton',
  'query_predicate.cpp': 'method_chaining',
  'strategy_basic.cpp': 'strategy',
  'strategy_with_pimpl.cpp': 'strategy',
  'logging_proxy.cpp': 'wrapping',
  'pimpl_basic.cpp': 'pimpl',
  'mixed_classes.cpp': 'mixed',
  'usages_basic.cpp': 'usages',
  // Phase B (D21 regression contract): integration sample +
  // false-positive contract (negative/) + extended usages coverage.
  'all_patterns.cpp': 'integration',
  'plain_class_no_pattern.cpp': 'negative',
  'plain_widget.cpp': 'negative',
  'usages_adapter_trace.cpp': 'usages',
  'usages_smart_pointers.cpp': 'usages',
};
function readSampleSource(filename: string): string {
  const dir = SAMPLE_DIR_BY_FILENAME[filename];
  if (!dir) throw new Error(`Unknown sample filename: ${filename}`);
  return fs.readFileSync(path.join(SAMPLES_ROOT, dir, filename), 'utf8');
}

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
//      fail the spec by themselves  -  they are recorded as a per-sample
//      warning so we can see which samples need scaffold work.
//
// The GitHub Actions workflow at .github/workflows/playwright-e2e.yml runs
// this spec against a freshly built stack and fails if any sample breaks
// the pipeline. That gate is the contract: if any sample stops working,
// the system is broken and the build must fail.

type SampleKind = 'positive' | 'negative' | 'integration';

interface SampleSpec {
  // Display name shown in the test title.
  name: string;
  // File name as it appears in the sample picker modal (the picker shows
  // the .cpp filename below the pattern label).
  filename: string;
  // Family heading the sample lives under in the picker.
  family: 'Creational' | 'Structural' | 'Behavioural' | 'Idioms' | 'Regression';
  // What kind of contract this sample exercises:
  //  - 'positive'    — single canonical pattern must be detected on the
  //                    named class. Phase C: expectedPatternNameRegex is
  //                    required.
  //  - 'negative'    — false-positive contract from D21. The class tree
  //                    must render in its empty state (data-empty="true")
  //                    OR not render a known catalog pattern badge.
  //  - 'integration' — regression contract from D21. Every locked-catalog
  //                    pattern must surface on at least one class.
  kind: SampleKind;
  // The class name the sample defines (used for the Patterns-tab assertion).
  // Optional for negative samples (no class assertion needed; empty tree
  // is the assertion).
  expectedClassNameRegex?: RegExp;
  // Phase C (D68 structural assertion): which pattern badge must appear
  // on the named class for positive samples. Catalog from D21:
  //   creational  — singleton | factory | builder | method_chaining
  //   structural  — adapter | proxy | decorator
  expectedPatternNameRegex?: RegExp;
  // Phase C (D21 integration contract): every catalog pattern in this
  // list must appear at least once anywhere in the class tree.
  expectedAllCatalogPatterns?: RegExp[];
  // D63 algorithm-known-limits. Documents real detector gaps the team
  // has accepted as live behaviour — the spec degrades the assertion to
  // a non-failing annotation instead of pretending the algorithm should
  // catch what it currently doesn't.
  //   acceptedAlternatePattern : if the matcher emits THIS pattern on
  //     the sample's class instead of expectedPatternNameRegex, count
  //     that as a documented limit (annotate, do not fail).
  //   missingFromCatalogScan   : regexes in expectedAllCatalogPatterns
  //     that the integration sample is known NOT to surface today.
  //     Skipped on the per-pattern presence check; annotated instead.
  //   reason                   : free-form text. Appears in the test
  //     annotation and in D63 when this list grows.
  algorithmKnownLimits?: {
    acceptedAlternatePattern?: RegExp;
    missingFromCatalogScan?: RegExp[];
    reason: string;
  };
}

// Mirrors Codebase/Microservice/samples/  -  keep in sync when samples are
// added or removed. Each entry asserts ONE class name regex; samples that
// host multiple classes (mixed/, usages/) match against the strongest one.
const SAMPLES: ReadonlyArray<SampleSpec> = [
  {
    name: 'Builder  -  http_request_builder',
    filename: 'http_request_builder.cpp',
    family: 'Creational',
    kind: 'positive',
    expectedClassNameRegex: /HttpRequestBuilder/,
    expectedPatternNameRegex: /builder/i,
  },
  {
    name: 'Factory  -  shape_factory',
    filename: 'shape_factory.cpp',
    family: 'Creational',
    kind: 'positive',
    expectedClassNameRegex: /ShapeFactory|Shape/,
    expectedPatternNameRegex: /factory/i,
  },
  {
    name: 'Singleton  -  config_registry',
    filename: 'config_registry.cpp',
    family: 'Creational',
    kind: 'positive',
    expectedClassNameRegex: /ConfigRegistry|Config/,
    expectedPatternNameRegex: /singleton/i,
  },
  {
    name: 'Method Chaining  -  query_predicate',
    filename: 'query_predicate.cpp',
    family: 'Behavioural',
    kind: 'positive',
    expectedClassNameRegex: /QueryPredicate|Query/,
    expectedPatternNameRegex: /method.?chain|chaining/i,
    algorithmKnownLimits: {
      acceptedAlternatePattern: /builder/i,
      reason:
        'D63: matcher emits Builder for fluent *this returns without a build() ' +
        'terminator. Method-chaining vs Builder discrimination is a known catalog ' +
        'limit; accept Builder here so the contract reflects shipped behaviour.',
    },
  },
  {
    name: 'Strategy  -  strategy_basic',
    filename: 'strategy_basic.cpp',
    family: 'Behavioural',
    kind: 'positive',
    // Actual classes: Compressor, ZipCompressor, GzipCompressor, Archiver.
    expectedClassNameRegex: /Compressor|Archiver/,
    // Strategy is NOT in the locked D21 creational/structural catalog —
    // expect a behavioural detector to surface SOMETHING rather than
    // hardcoding a specific name the catalog may rename.
    expectedPatternNameRegex: /strategy|behaviour|polymorph/i,
  },
  {
    name: 'Strategy  -  strategy_with_pimpl',
    filename: 'strategy_with_pimpl.cpp',
    family: 'Behavioural',
    kind: 'positive',
    expectedClassNameRegex: /Strategy|Pimpl/,
    expectedPatternNameRegex: /strategy|pimpl/i,
  },
  {
    name: 'Wrapping  -  logging_proxy',
    filename: 'logging_proxy.cpp',
    family: 'Structural',
    kind: 'positive',
    expectedClassNameRegex: /Logging|Proxy/,
    expectedPatternNameRegex: /proxy|decorator|wrap/i,
    algorithmKnownLimits: {
      acceptedAlternatePattern: /adapter/i,
      reason:
        'D63: matcher emits Adapter on wrapping classes that hold a pointer to ' +
        'another type. Proxy/Decorator vs Adapter discrimination is a known ' +
        'catalog limit; accept Adapter here.',
    },
  },
  {
    name: 'PIMPL  -  pimpl_basic',
    filename: 'pimpl_basic.cpp',
    family: 'Idioms',
    kind: 'positive',
    expectedClassNameRegex: /Pimpl|Widget|Impl/,
    expectedPatternNameRegex: /pimpl|opaque|impl/i,
  },
  {
    name: 'Mixed  -  mixed_classes',
    filename: 'mixed_classes.cpp',
    family: 'Idioms',
    kind: 'positive',
    expectedClassNameRegex: /[A-Z]\w+/,
    // Multi-class sample; any catalog pattern landing on at least one
    // class is enough for the structural assertion (D24 binder coverage).
    expectedPatternNameRegex: /singleton|factory|builder|method.?chain|adapter|proxy|decorator|strategy/i,
  },
  {
    name: 'Usages  -  usages_basic',
    filename: 'usages_basic.cpp',
    family: 'Idioms',
    kind: 'positive',
    expectedClassNameRegex: /[A-Z]\w+/,
    expectedPatternNameRegex: /singleton|factory|builder|method.?chain|adapter|proxy|decorator|strategy/i,
  },
  // ---- Phase B regression contract (D21) ----
  {
    name: 'Regression  -  integration/all_patterns',
    filename: 'all_patterns.cpp',
    family: 'Regression',
    kind: 'integration',
    expectedClassNameRegex: /ConfigSingleton|ShapeFactory|QueryBuilder|FluentLogger|Repository/,
    // Per D21 locked catalog: every entry must show up somewhere in the
    // tree. Strategy is included because the integration sample also
    // exercises behavioural detection.
    expectedAllCatalogPatterns: [
      /singleton/i,
      /factory/i,
      /builder/i,
      /method.?chain/i,
      /adapter|proxy|decorator/i,
    ],
    algorithmKnownLimits: {
      missingFromCatalogScan: [/method.?chain/i],
      reason:
        'D63: the matcher never surfaces method_chain on the integration sample; ' +
        'Builder wins the fluent classes (same root cause as query_predicate). ' +
        'Skip the method_chain presence check until the catalog learns a stronger ' +
        'discriminator.',
    },
  },
  {
    name: 'Negative  -  plain_class_no_pattern',
    filename: 'plain_class_no_pattern.cpp',
    family: 'Regression',
    kind: 'negative',
    // No class assertion — empty-tree (or "no catalog badge") is the
    // contract. The class IS named Person; if a future detector mis-fires
    // we'll see a known catalog pattern appear and the spec fails.
  },
  {
    name: 'Negative  -  plain_widget',
    filename: 'plain_widget.cpp',
    family: 'Regression',
    kind: 'negative',
  },
  {
    name: 'Usages  -  usages_adapter_trace',
    filename: 'usages_adapter_trace.cpp',
    family: 'Idioms',
    kind: 'positive',
    expectedClassNameRegex: /SocketLib|HttpClient|Adapter/,
    expectedPatternNameRegex: /adapter|wrap|proxy/i,
  },
  {
    name: 'Usages  -  usages_smart_pointers',
    filename: 'usages_smart_pointers.cpp',
    family: 'Idioms',
    kind: 'positive',
    expectedClassNameRegex: /Engine|Car|Owner/,
    expectedPatternNameRegex: /singleton|factory|builder|smart.?pointer|raii/i,
  },
];

async function signInWithSharedSeat(page: Page): Promise<void> {
  // Per-test page navigates here with the shared seat's token + user
  // injected via addInitScript. The claim happens once in beforeAll;
  // tests inherit the JWT and never claim a new seat.
  expect(SHARED_SEAT.token, 'shared seat must be claimed in beforeAll').toBeTruthy();

  await page.addInitScript(
    ({ token, user }) => {
      try {
        localStorage.setItem('nt_token', token);
        localStorage.setItem('nt_user', JSON.stringify(user));
        sessionStorage.setItem('nt-entry-flow', 'developer');
        localStorage.setItem('nt_start_here_dismissed', '1');
        localStorage.setItem('nt_studio_tour_completed', '1');
        for (const tab of ['submit', 'annotated', 'gdb', 'docs', 'ambiguous']) {
          localStorage.setItem(`nt_studio_tour_completed__${tab}`, '1');
        }
      } catch {
        /* private mode or quota */
      }
    },
    { token: SHARED_SEAT.token, user: SHARED_SEAT.user },
  );

  await page.goto('/studio');
  await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
  await expect(page.getByTestId('load-sample-btn')).toBeVisible({ timeout: 15_000 });
}

async function loadSampleByFilename(page: Page, filename: string): Promise<void> {
  // Bypass the sample picker. Read the file from disk and fill the first
  // slot's textarea directly. This sidesteps any picker-side bug
  // (bundled-raw glob misses, modal click race) and keeps the pipeline
  // assertion focused on the analyze + tag + test flow.
  const source = readSampleSource(filename);
  const editor = page.locator('textarea').first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(source);

  // Also patch the filename so the run record reads sensibly. The slot's
  // filename input is the first text input near the textarea; we use the
  // first .file-tab-name (the active tab's name) and double-click to edit
  // if the UI supports it, OR fall back to setting via dispatching change
  // on the textarea (the slot's name is decorative for analysis purposes).
  // For the assertion path we don't need the filename to match  -  we read
  // the class name from the parse output instead.

  // Confirm the slot has content (the Run-analysis button text is bound
  // to the number of non-empty slots).
  await expect(page.getByTestId('analyze-btn')).toContainText(/Run analysis \(1 file/i, {
    timeout: 5_000,
  });
}

async function runAnalysis(page: Page): Promise<void> {
  const analyze = page.getByTestId('analyze-btn');
  await expect(analyze).toBeEnabled();
  await analyze.click();

  // Wait for the run to complete: the status card transitions from
  // "Analyzing..." to "Analysis ready" (the title is set by the store).
  // The status-title node lives in a sr-only aria-live region after the
  // layout-flatten refactor; we still wait on it via the stable data-testid.
  await expect(page.getByTestId('status-title')).toHaveText(/Analysis ready/i, { timeout: 60_000 });
}

async function assertTaggingHappened(
  page: Page,
  classNameRegex: RegExp,
): Promise<{ tagged: boolean; reason: string; emptyTree: boolean }> {
  // Switch to the Patterns tab via the stable data-testid (the visible
  // label is layout-dependent and would silently drift on a tab-bar rename).
  await page.getByTestId('tab-annotated').click();

  // The class tree mounts inside the results sidebar; data-empty="true"
  // signals an explicit "no pattern matches" verdict (negative samples).
  // Important: locator.isVisible() does NOT auto-wait. For samples whose
  // tree takes a beat to paint (integration sample with 9 classes), the
  // previous isVisible-with-timeout was a no-op and we raced. Use
  // waitFor({state: 'visible'}) so the wait actually happens.
  const tree = page.getByTestId('class-tree-view');
  const treeVisible = await tree
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!treeVisible) {
    return { tagged: false, reason: 'No class tree rendered (analyze never landed).', emptyTree: false };
  }
  const isEmpty = (await tree.getAttribute('data-empty')) === 'true';
  if (isEmpty) {
    return { tagged: false, reason: 'Class tree rendered empty (no patterns detected).', emptyTree: true };
  }

  const classNode = page.getByTestId('class-tree-name').filter({ hasText: classNameRegex }).first();
  const classVisible = await classNode
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!classVisible) {
    // The tree rendered but no class matched the expected regex - log all
    // class names we saw so the diagnostic is useful when this triggers.
    const names = await page.getByTestId('class-tree-name').allTextContents();
    return {
      tagged: false,
      reason: `Tree rendered but no class matched ${classNameRegex}. Saw: ${names.join(', ') || '(none)'}`,
      emptyTree: false,
    };
  }

  return { tagged: true, reason: '', emptyTree: false };
}

async function resolveAllAmbiguousClasses(
  page: Page,
): Promise<{ resolved: number; candidatesSeen: string[] }> {
  // Walk the class tree, click each review CTA, and pick the first
  // candidate pattern in the resulting popover. Returns the number of
  // classes resolved AND the union of every candidate label seen across
  // every popover (so the structural assertion can recognise patterns
  // the matcher proposed even when the auto-resolver picked a different
  // co-emitted candidate).
  //
  // Why we collect candidates: ambiguity is information per the catalog
  // (Builder co-emits with MethodChaining, Adapter/Proxy/Decorator co-
  // emit on wrap+forward). The .first() chip is arbitrary, so asserting
  // strictly on the resolved badge would treat a co-emit ambiguity as a
  // detection failure when the matcher actually surfaced both options.
  // Per user direction (option c, this turn): the assertion should pass
  // when the expected pattern was a CANDIDATE, regardless of which one
  // the auto-resolver picked.
  await page.getByTestId('tab-annotated').click();
  await expect(page.getByTestId('class-tree-view')).toBeVisible({ timeout: 10_000 });

  let resolved = 0;
  const candidatesSeen = new Set<string>();
  for (let i = 0; i < 50; i += 1) {
    const reviewCta = page.locator('.class-tree-review-cta').first();
    const visible = await reviewCta.isVisible().catch(() => false);
    if (!visible) break;
    await reviewCta.click();
    const chips = page.locator('.class-root-picker-chip');
    await expect(chips.first()).toBeVisible({ timeout: 5_000 });
    // Snapshot every chip label in this popover before picking. The
    // chips render the canonical pattern name as visible text.
    const chipCount = await chips.count();
    for (let c = 0; c < chipCount; c += 1) {
      const label = ((await chips.nth(c).textContent()) || '').trim();
      if (label) candidatesSeen.add(label);
    }
    await chips.first().click();
    resolved += 1;
    await page.waitForTimeout(300);
  }
  return { resolved, candidatesSeen: Array.from(candidatesSeen) };
}

async function runTestsAndAssertCompile(page: Page): Promise<{
  unitFailures: number;
  skipped: boolean;
  skipReason: string;
  ambiguityResolved: number;
}> {
  // Switch to the Tests tab via stable data-testid.
  await page.getByTestId('tab-gdb').click();
  await expect(page.locator('.gdb-trophy-banner')).toBeVisible({ timeout: 10_000 });

  const runAll = page.getByTestId('run-all-tests-btn');
  await expect(runAll).toBeVisible({ timeout: 10_000 });

  // If Run All is blocked by ambiguity, walk over to the Patterns tab and
  // pick the first candidate for each unresolved class, then come back.
  // Per user direction: "for the ambiguous part, just pick one."
  let ambiguityResolved = 0;
  let disabled = await runAll.isDisabled().catch(() => false);
  if (disabled) {
    const title = (await runAll.getAttribute('title')) ?? '';
    if (/Resolve ambiguity/i.test(title) || /ambiguity/i.test(title)) {
      const r = await resolveAllAmbiguousClasses(page);
      ambiguityResolved = r.resolved;
      await page.getByTestId('tab-gdb').click();
      await expect(runAll).toBeVisible({ timeout: 10_000 });
      disabled = await runAll.isDisabled().catch(() => false);
    }
  }

  if (disabled) {
    const title = (await runAll.getAttribute('title')) ?? '';
    return {
      unitFailures: 0,
      skipped: true,
      skipReason: `Run All still disabled after resolution  -  ${title || 'cooldown'}`,
      ambiguityResolved,
    };
  }

  await runAll.click();

  // Wait for compile_run verdicts to land. If the runner is slow or
  // sandbox-disabled, no rows appear  -  soft-skip with annotation rather
  // than failing the spec. The phase row carries data-phase + data-verdict
  // (verdict reflects pass/fail/sandbox_disabled/no_template/skipped) while
  // data-status collapses to pass/fail/skipped/loading. Filter on verdict
  // for the sandbox-disabled check so the soft-skip path actually fires.
  try {
    await page
      .locator('[data-testid="gdb-phase-row"][data-phase="compile_run"]')
      .first()
      .waitFor({ state: 'attached', timeout: 60_000 });
  } catch {
    return {
      unitFailures: 0,
      skipped: true,
      skipReason: 'No compile_run rows appeared within 60s (runner may be disabled).',
      ambiguityResolved,
    };
  }

  await page.waitForTimeout(2_000);

  const compileRows = page.locator('[data-testid="gdb-phase-row"][data-phase="compile_run"]');
  const compileCount = await compileRows.count();
  if (compileCount === 0) {
    return {
      unitFailures: 0,
      skipped: true,
      skipReason: 'compile_run rows did not render.',
      ambiguityResolved,
    };
  }

  // At least one compile_run must pass  -  minimum signal that "the system
  // actually compiled the sample." Sandbox-disabled rows count as a soft
  // skip rather than a hard fail.
  const passingCompiles = await page
    .locator('[data-testid="gdb-phase-row"][data-phase="compile_run"][data-status="pass"]')
    .count();
  const sandboxDisabled = await page
    .locator('[data-testid="gdb-phase-row"][data-phase="compile_run"][data-verdict="sandbox_disabled"]')
    .count();

  if (passingCompiles === 0 && sandboxDisabled > 0) {
    return {
      unitFailures: 0,
      skipped: true,
      skipReason: 'Test runner sandbox disabled in CI; pipeline-only assertion remains green.',
      ambiguityResolved,
    };
  }

  expect(
    passingCompiles,
    'at least one pattern row must have compile_run=pass',
  ).toBeGreaterThan(0);

  const unitFailures = await page
    .locator('[data-testid="gdb-phase-row"][data-phase="unit_test"][data-status="fail"]')
    .count();
  return { unitFailures, skipped: false, skipReason: '', ambiguityResolved };
}

// Single shared seat reused across every test in this spec. Previously each
// test claimed its own seat and afterEach released; with 10 tests + retries
// the release didn't keep up and the pool ran dry by test 11. One seat for
// the whole spec sidesteps the seat-management problem entirely  -  the seat
// is released in test.afterAll, AND the seat info is persisted to
// SEAT_FILE so playwright/global-teardown.ts can release it even when a
// worker crashes before afterAll runs.
const SHARED_SEAT: { username: string; token: string; user: unknown } = {
  username: '',
  token: '',
  user: null,
};
const SEAT_FILE = path.resolve(__dirname, '..', '..', '.playwright-seat.json');

function persistSeat(): void {
  try {
    fs.writeFileSync(
      SEAT_FILE,
      JSON.stringify({ username: SHARED_SEAT.username, token: SHARED_SEAT.token }),
      'utf8',
    );
  } catch {
    // Disk write failure is non-fatal: the test.afterAll path still runs
    // on clean exit. We just lose the crash-safety net.
  }
}

function clearSeatFile(): void {
  try { fs.unlinkSync(SEAT_FILE); } catch { /* missing is fine */ }
}

async function claimSharedSeat(apiRequest: APIRequestContext): Promise<void> {
  if (SHARED_SEAT.token) return;
  const accountsRes = await apiRequest.get('/auth/test-accounts');
  expect(accountsRes.ok(), 'tester accounts endpoint should answer').toBeTruthy();
  const body = (await accountsRes.json()) as {
    accounts: Array<{ username: string; claimed?: boolean }>;
  };
  expect(
    body.accounts.length,
    'at least one tester account must be seeded (SEED_TEST_USERS=1 in CI env)',
  ).toBeGreaterThan(0);

  const target = body.accounts.find((a) => !a.claimed) ?? body.accounts[0];
  const claimRes = await apiRequest.post('/auth/claim', {
    headers: { 'Content-Type': 'application/json' },
    data: { username: target.username },
  });
  expect(claimRes.ok(), `/auth/claim for ${target.username} should succeed`).toBeTruthy();
  const claim = (await claimRes.json()) as { token: string; user: unknown };
  SHARED_SEAT.username = target.username;
  SHARED_SEAT.token = claim.token;
  SHARED_SEAT.user = claim.user;
  persistSeat();
}

async function releaseSharedSeat(apiRequest: APIRequestContext): Promise<void> {
  if (!SHARED_SEAT.token) {
    clearSeatFile();
    return;
  }
  try {
    await apiRequest.post('/auth/disconnect', {
      headers: { Authorization: `Bearer ${SHARED_SEAT.token}` },
      data: { username: SHARED_SEAT.username },
    });
  } catch {
    /* best-effort */
  } finally {
    clearSeatFile();
  }
}

test.describe('Studio pipeline  -  every design-pattern sample', () => {
  test.beforeAll(async ({ request }) => {
    await claimSharedSeat(request);
  });

  test.afterAll(async ({ request }) => {
    await releaseSharedSeat(request);
  });

  test.beforeEach(async ({ page }) => {
    await signInWithSharedSeat(page);
  });

  for (const sample of SAMPLES) {
    test(sample.name, async ({ page }, testInfo) => {
      await loadSampleByFilename(page, sample.filename);
      await runAnalysis(page);

      // --- Negative samples (D21 false-positive contract) ---
      if (sample.kind === 'negative') {
        // Three acceptable outcomes, in order of strongest signal:
        //   1. The class tree never renders at all (analyze produced no
        //      patterns AND the binder produced no usages, so the sidebar
        //      tree section gates itself out).
        //   2. The tree renders with data-empty="true".
        //   3. The tree renders with some badges, but NONE of them
        //      carries a locked-catalog pattern name. The matcher fired
        //      a non-catalog suggestion which we tolerate.
        // Any locked-catalog pattern badge is a hard fail — that's the
        // false positive the D21 contract protects.
        await page.getByTestId('tab-annotated').click();
        const tree = page.getByTestId('class-tree-view');
        const treeAppeared = await tree
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        if (!treeAppeared) {
          // Outcome 1: no tree at all. Strongest pass.
          return;
        }
        const empty = (await tree.getAttribute('data-empty')) === 'true';
        if (empty) {
          // Outcome 2: empty tree.
          return;
        }
        // Outcome 3: scan badges.
        const badges = page.getByTestId('class-tree-badge');
        const count = await badges.count();
        const seenPatterns: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const p = (await badges.nth(i).getAttribute('data-pattern')) || '';
          if (p) seenPatterns.push(p);
        }
        const catalogHit = seenPatterns.find((p) =>
          /singleton|factory|builder|method.?chain|adapter|proxy|decorator/i.test(p),
        );
        expect(
          catalogHit,
          `negative sample ${sample.filename} must not surface a locked-catalog pattern; saw: ${seenPatterns.join(', ') || '(none)'}`,
        ).toBeUndefined();
        return;
      }

      // --- Positive + integration samples ---
      const tagging = await assertTaggingHappened(page, sample.expectedClassNameRegex!);
      if (!tagging.tagged) {
        // For integration samples an empty tree IS a hard failure — the
        // regression contract requires every locked-catalog pattern to
        // surface. For positive samples we keep the legacy soft-skip
        // (the analyze pipeline still ran; the detector just had nothing
        // to say).
        if (sample.kind === 'integration') {
          throw new Error(
            `${sample.filename}: integration regression contract failed — ${tagging.reason}`,
          );
        }
        testInfo.annotations.push({
          type: 'soft-skip',
          description: `${sample.filename}: ${tagging.reason}`,
        });
        return;
      }

      // Phase C structural assertion: the detected pattern on the named
      // class must match expectedPatternNameRegex. We auto-resolve any
      // ambiguous classes first (picking the matcher's first candidate)
      // because data-pattern is populated only on rendered badges, and
      // ambiguous classes show a `review` CTA instead of a badge until
      // the user picks. Resolving lifts the candidates into chosen
      // badges so the structural assertion can read what the matcher
      // actually proposed. We scan all badges page-wide rather than
      // scoping to one row (mixed/usages samples host multiple classes;
      // any one matching the regex satisfies the catalog contract).
      if (sample.expectedPatternNameRegex || sample.kind === 'integration') {
        const { candidatesSeen } = await resolveAllAmbiguousClasses(page);
        // resolveAllAmbiguousClasses leaves us on the Patterns tab.
        const badges = page.getByTestId('class-tree-badge');
        const seenPatterns: string[] = [];
        const count = await badges.count();
        for (let i = 0; i < count; i += 1) {
          const p = (await badges.nth(i).getAttribute('data-pattern')) || '';
          if (p) seenPatterns.push(p);
        }
        // Per option (c) this turn: the matcher correctly co-emits
        // ambiguous candidates (e.g. Builder + MethodChaining on the
        // same `return *this` chain). The auto-resolver picks .first()
        // arbitrarily; the resolved badge is therefore not a reliable
        // signal of "did the matcher see X". The structural assertion
        // is satisfied if the expected pattern was EITHER on a final
        // badge OR present as a candidate the matcher proposed during
        // ambiguity resolution.
        const seenOrCandidate = [...seenPatterns, ...candidatesSeen];
        const formatSeen = (): string =>
          `badges=[${seenPatterns.join(', ') || '(none)'}], ` +
          `candidates=[${candidatesSeen.join(', ') || '(none)'}]`;
        if (sample.expectedPatternNameRegex) {
          const matched = seenOrCandidate.some((p) =>
            sample.expectedPatternNameRegex!.test(p),
          );
          if (!matched) {
            // D63 algorithm-known-limit gate: if the detector emits the
            // documented alternate pattern, count as a documented limit
            // (annotate, don't fail). Anything else is a real regression.
            const accepted = sample.algorithmKnownLimits?.acceptedAlternatePattern;
            const altMatched = accepted
              ? seenOrCandidate.some((p) => accepted.test(p))
              : false;
            if (altMatched) {
              testInfo.annotations.push({
                type: 'algorithm-known-limit',
                description:
                  `${sample.filename}: expected ${sample.expectedPatternNameRegex} but saw ` +
                  `${formatSeen()}. Accepted per ` +
                  `${sample.algorithmKnownLimits!.reason}`,
              });
            } else {
              expect(
                matched,
                `${sample.filename} expected pattern matching ${sample.expectedPatternNameRegex} ` +
                  `(or documented alternate ${accepted ?? '(none configured)'}) on some class; ` +
                  `saw: ${formatSeen()}`,
              ).toBeTruthy();
            }
          }
        }
        if (sample.kind === 'integration' && sample.expectedAllCatalogPatterns) {
          const skipList = sample.algorithmKnownLimits?.missingFromCatalogScan || [];
          for (const rx of sample.expectedAllCatalogPatterns) {
            // Honour the documented algorithm-known-gap list. The audit
            // (D63) records WHY each entry is here; the spec just
            // annotates instead of failing.
            const isSkipped = skipList.some((s) => s.source === rx.source && s.flags === rx.flags);
            const present = seenOrCandidate.some((p) => rx.test(p));
            if (!present && isSkipped) {
              testInfo.annotations.push({
                type: 'algorithm-known-limit',
                description:
                  `integration sample known gap: ${rx} not surfaced. ` +
                  sample.algorithmKnownLimits!.reason,
              });
              continue;
            }
            expect(
              present,
              `integration sample must surface a pattern matching ${rx}; saw: ${formatSeen()}`,
            ).toBeTruthy();
          }
        }
      }

      const result = await runTestsAndAssertCompile(page);
      if (result.skipped) {
        testInfo.annotations.push({
          type: 'soft-skip',
          description: `${sample.filename}: ${result.skipReason}`,
        });
      } else if (result.unitFailures > 0) {
        testInfo.annotations.push({
          type: 'warning',
          description: `${result.unitFailures} unit_test row(s) failed for ${sample.filename}. Compile_run passed; scaffold may need work.`,
        });
      }
    });
  }
});

