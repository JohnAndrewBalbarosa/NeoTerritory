import { APIRequestContext, Page, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { waitForStable } from '../helpers/waitForStable';

// Page Object Model for the studio.
//
// Wraps the dynamic-aware operations that any spec touching the studio
// has to repeat: seat claim, JWT inject, sample load, analyse, switch
// tab, wait for SSE-driven content to finish streaming.
//
// Reuses the patterns already proven by playwright/tests/all-samples.spec.ts:
//   - /auth/test-accounts + /auth/claim for a shared seat
//   - localStorage init script for nt_token / nt_user / tour-completed
//     flags / start-here dismissal
//   - textarea.fill() to bypass the sample picker modal
//   - SSE done detection on the Tests tab
//
// Public surface is intentionally small so screenshot specs read like
// a script: studio.tab('annotated'); await studio.snapshot('patterns-tab').
//
// `snapshot()` is dynamic-aware: it calls waitForStable() (DOM mutations,
// running CSS animations, in-flight requests) before each shot, so the
// screenshot never lands mid-transition.

export type StudioTabId = 'submit' | 'annotated' | 'gdb' | 'docs' | 'ambiguous';

interface ClaimedSeat {
  username: string;
  token: string;
  user: unknown;
}

const STUDIO_TAB_LABELS: Record<StudioTabId, string> = {
  submit: 'Submit',
  annotated: 'Patterns',
  gdb: 'Tests',
  docs: 'Docs',
  ambiguous: 'Self-check',
};

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
  'logging_proxy.cpp': 'wrapping',
  'pimpl_basic.cpp': 'pimpl',
};

function readSampleSource(filename: string): string {
  const dir = SAMPLE_DIR_BY_FILENAME[filename];
  if (!dir) throw new Error(`Unknown sample filename: ${filename}`);
  return fs.readFileSync(path.join(SAMPLES_ROOT, dir, filename), 'utf8');
}

export class StudioPage {
  private stepCounter = 0;

  constructor(
    public readonly page: Page,
    public readonly screenshotDir: string,
  ) {}

  // ---- Auth / seat ----

  static async claimSeat(apiRequest: APIRequestContext): Promise<ClaimedSeat> {
    const accountsRes = await apiRequest.get('/auth/test-accounts');
    expect(accountsRes.ok(), '/auth/test-accounts should respond').toBeTruthy();
    const body = (await accountsRes.json()) as {
      accounts: Array<{ username: string; claimed?: boolean }>;
    };
    expect(
      body.accounts.length,
      'at least one tester account must be seeded (SEED_TEST_USERS=1)',
    ).toBeGreaterThan(0);

    const target = body.accounts.find((a) => !a.claimed) ?? body.accounts[0];
    const claimRes = await apiRequest.post('/auth/claim', {
      headers: { 'Content-Type': 'application/json' },
      data: { username: target.username },
    });
    expect(claimRes.ok(), '/auth/claim should succeed').toBeTruthy();
    const claim = (await claimRes.json()) as { token: string; user: unknown };
    return { username: target.username, token: claim.token, user: claim.user };
  }

  static async releaseSeat(
    apiRequest: APIRequestContext,
    seat: ClaimedSeat,
  ): Promise<void> {
    if (!seat.token) return;
    try {
      await apiRequest.post('/auth/disconnect', {
        headers: { Authorization: `Bearer ${seat.token}` },
        data: { username: seat.username },
      });
    } catch {
      /* best-effort */
    }
  }

  // ---- Navigation ----

  /**
   * Inject the seat's JWT + tour-suppression flags into localStorage BEFORE
   * the first navigation, then land on /studio.
   */
  async signIn(seat: ClaimedSeat): Promise<void> {
    await this.page.addInitScript(
      ({ token, user }) => {
        try {
          localStorage.setItem('nt_token', token);
          localStorage.setItem('nt_user', JSON.stringify(user));
          sessionStorage.setItem('nt-entry-flow', 'developer');
          localStorage.setItem('nt_start_here_dismissed', '1');
          // Single global completion flag now. The legacy per-tab keys are
          // set too so older builds that still read them don't auto-open.
          localStorage.setItem('nt_studio_tour_completed', '1');
          for (const tab of ['submit', 'annotated', 'gdb', 'docs', 'ambiguous']) {
            localStorage.setItem(`nt_studio_tour_completed__${tab}`, '1');
          }
        } catch {
          /* private mode or quota */
        }
      },
      { token: seat.token, user: seat.user },
    );

    await this.page.goto('/studio');
    await expect(this.page).toHaveURL(/\/studio/, { timeout: 15_000 });
    await expect(this.page.getByTestId('load-sample-btn')).toBeVisible({ timeout: 15_000 });
  }

  /** Click a studio tab. Waits for the page to settle before returning. */
  async tab(id: StudioTabId): Promise<void> {
    // Tab buttons carry data-testid="tab-<id>" — stable across layout
    // refactors and label/i18n changes. Falls back to the label-by-text
    // matcher only if the testid isn't found (legacy stack).
    const byTestId = this.page.getByTestId(`tab-${id}`);
    if (await byTestId.count() > 0) {
      await byTestId.click();
    } else {
      const label = STUDIO_TAB_LABELS[id];
      await this.page.locator(`button[role="tab"]:has-text("${label}")`).click();
    }
    await waitForStable(this.page);
  }

  // ---- Submit tab ----

  /**
   * Bypass the sample picker and fill the editor directly from disk. Same
   * pattern used by all-samples.spec.ts:loadSampleByFilename.
   */
  async loadSample(filename: string): Promise<void> {
    const source = readSampleSource(filename);
    const editor = this.page.locator('textarea').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.fill(source);
    await expect(this.page.getByTestId('analyze-btn')).toContainText(/Run analysis \(1 file/i, {
      timeout: 5_000,
    });
  }

  /** Click Analyze and wait for the run-complete signal. */
  async analyze(): Promise<void> {
    const analyze = this.page.getByTestId('analyze-btn');
    await expect(analyze).toBeEnabled();
    await analyze.click();
    // The status card transitions to "Analysis ready" when the run lands.
    // The status-title lives in a sr-only aria-live region — data-testid
    // stays stable across the layout-flatten refactor.
    await expect(this.page.getByTestId('status-title')).toHaveText(/Analysis ready/i, {
      timeout: 60_000,
    });
    await waitForStable(this.page);
  }

  // ---- Tests tab (SSE-streamed) ----

  /**
   * Click Run-all-tests and wait for the SSE stream to deliver all per-pattern
   * verdicts. Detection: the per-phase rows have rendered AND no `Running…`
   * text remains on screen AND the page has stopped mutating for the quiet
   * window.
   */
  async runTestsAndWait(): Promise<void> {
    const runBtn = this.page.locator('button.primary-btn', { hasText: /Run all tests/ }).first();
    // The button is disabled when canRun=false; spec calling this method is
    // responsible for ensuring a run exists first.
    await runBtn.waitFor({ state: 'visible', timeout: 10_000 });
    if (await runBtn.isEnabled()) {
      await runBtn.click();
    }

    // Wait until at least one phase row has attached, then for the stream to
    // settle (no `Running…` text + page stable).
    await this.page
      .locator('.gdb-result, .gdb-phase-row, [data-phase]')
      .first()
      .waitFor({ state: 'attached', timeout: 60_000 })
      .catch(() => {
        /* If the runner is disabled we still want a screenshot of the disabled-reason chip. */
      });

    await this.page.waitForFunction(
      () => !document.body.innerText.match(/Running…|Running\.\.\./),
      undefined,
      { timeout: 60_000 },
    ).catch(() => {
      /* Tolerate timeout — final screenshot still captures the in-flight state. */
    });
    await waitForStable(this.page, { timeoutMs: 12_000, quietWindowMs: 600 });
  }

  // ---- Screenshot pipeline ----

  /**
   * Take a numbered, dynamic-aware screenshot of the current viewport.
   *
   * The filename is `NN-<slug>.png` where NN is auto-incremented per
   * StudioPage instance, so the on-disk ordering matches the script's
   * execution order without the caller having to manage step numbers.
   */
  async snapshot(slug: string, opts: { fullPage?: boolean } = {}): Promise<string> {
    this.stepCounter += 1;
    const idx = this.stepCounter.toString().padStart(2, '0');
    const safeSlug = slug.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const filename = `${idx}-${safeSlug}.png`;
    const outPath = path.join(this.screenshotDir, filename);
    fs.mkdirSync(this.screenshotDir, { recursive: true });

    await waitForStable(this.page, { timeoutMs: 8000, quietWindowMs: 500 });
    await this.page.screenshot({
      path: outPath,
      fullPage: opts.fullPage ?? false,
      animations: 'disabled',
    });
    return outPath;
  }
}
