#!/usr/bin/env node
// One-off probe: reproduce the "Run All Tests does nothing" complaint.
// Captures console, network, and screenshots at every step so we can see
// whether the click fires, whether the request lands, whether SSE events
// arrive, and whether something re-mounts the panel.

import { chromium } from '../Codebase/Frontend/node_modules/playwright/index.mjs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT = path.join(ROOT, 'test-artifacts', 'run-all-probe');
const BASE = 'http://127.0.0.1:3001';

async function ensureDir(d) { await fs.mkdir(d, { recursive: true }); }

async function main() {
  await ensureDir(OUT);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  ctx.on('console', (msg) => {
    if (['error', 'warning', 'log'].includes(msg.type())) {
      console.log(`[console:${msg.type()}]`, msg.text());
    }
  });
  ctx.on('weberror', (e) => console.log('[pageerror]', e.error.message));
  ctx.on('requestfailed', (req) => console.log('[reqfail]', req.url(), req.failure()?.errorText));

  const page = await ctx.newPage();

  // Authenticate via API
  const accountsRes = await ctx.request.get(`${BASE}/auth/test-accounts`);
  const body = await accountsRes.json();
  const target = body.accounts.find((a) => !a.claimed) ?? body.accounts[0];
  const claimRes = await ctx.request.post(`${BASE}/auth/claim`, {
    data: { username: target.username },
  });
  const claim = await claimRes.json();
  console.log('[auth] claimed seat:', target.username);

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('nt_token', token);
    localStorage.setItem('nt_user', JSON.stringify(user));
    sessionStorage.setItem('nt-entry-flow', 'developer');
    localStorage.setItem('nt_start_here_dismissed', '1');
    for (const tab of ['submit', 'annotated', 'gdb', 'docs', 'ambiguous']) {
      localStorage.setItem(`nt_studio_tour_completed__${tab}`, '1');
    }
  }, { token: claim.token, user: claim.user });

  // Capture EVERY /api/ request to see what fires on Run All click.
  page.on('request', (req) => {
    if (req.url().includes('/api/') || req.url().includes('run-tests')) {
      console.log('[req]', req.method(), req.url());
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/analysis/') || res.url().includes('run-tests')) {
      console.log('[res]', res.status(), res.url(), 'ct=', res.headers()['content-type']);
    }
  });

  await page.goto(`${BASE}/studio`);
  await page.waitForSelector('#load-sample-btn', { timeout: 15000 });
  console.log('[step] studio loaded');

  // Fill editor with a Builder sample
  const src = await fs.readFile(path.join(ROOT, 'Codebase/Microservice/samples/builder/http_request_builder.cpp'), 'utf8');
  await page.locator('textarea').first().fill(src);

  // Submit
  await page.locator('#analyze-btn').click();
  await page.waitForSelector('#status-title:has-text("Analysis ready")', { timeout: 60000 });
  console.log('[step] analysis complete');
  await page.screenshot({ path: path.join(OUT, '01-after-analyze.png') });

  // Patterns tab + resolve ambiguity
  await page.locator('button[role="tab"]:has-text("Patterns")').click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 20; i++) {
    const cta = page.locator('.class-tree-review-cta').first();
    if (!(await cta.isVisible().catch(() => false))) break;
    await cta.click();
    const chip = page.locator('.class-root-picker-chip').first();
    await chip.waitFor({ state: 'visible', timeout: 5000 });
    await chip.click();
    await page.waitForTimeout(300);
  }
  console.log('[step] ambiguity resolved');
  await page.screenshot({ path: path.join(OUT, '02-after-resolve.png') });

  // Tests tab
  await page.locator('button[role="tab"]:has-text("Tests")').click();
  await page.waitForSelector('.gdb-trophy-banner', { timeout: 10000 });
  console.log('[step] tests tab open');
  await page.screenshot({ path: path.join(OUT, '03-tests-tab.png') });

  // Click Run All
  const runAll = page.locator('button:has-text("Run all tests")').first();
  await runAll.waitFor({ state: 'visible', timeout: 10000 });
  const enabled = await runAll.isEnabled();
  const title = await runAll.getAttribute('title');
  console.log('[step] Run-all enabled=', enabled, 'title=', title);

  if (!enabled) {
    console.log('[diag] Run All is DISABLED. Halting probe.');
    await page.screenshot({ path: path.join(OUT, '04-disabled.png') });
  } else {
    await runAll.click();
    console.log('[step] clicked Run all');

    // Snapshot DOM every 500ms for 8 sec
    for (let t = 0; t < 16; t++) {
      await page.waitForTimeout(500);
      const phaseCount = await page.locator('.gdb-phase-row').count();
      const phaseAttached = await page.locator('.gdb-phase-row[data-phase="compile_run"]').count();
      const busyPill = await page.locator('button:has-text("Running")').count();
      const errorBanner = await page.locator('.error-banner').count();
      const tabContent = await page.locator('main.tab-content').count();
      console.log(`[t+${(t * 0.5).toFixed(1)}s] phases=${phaseCount} compile_rows=${phaseAttached} busy_pill=${busyPill} err=${errorBanner} content=${tabContent}`);
    }
    await page.screenshot({ path: path.join(OUT, '05-after-runAll.png'), fullPage: true });

    // Capture the latest HTML of the tab-content area
    const html = await page.locator('main.tab-content').innerHTML().catch(() => '(missing)');
    await fs.writeFile(path.join(OUT, '06-tab-content.html'), html);
  }

  await ctx.close();
  await browser.close();
  console.log('[done] artifacts in', OUT);
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
