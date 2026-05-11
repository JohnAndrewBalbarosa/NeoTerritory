#!/usr/bin/env node
// Feature sweep: walk the local app and report which surfaces work,
// which silently fail, and which throw. Per user direction ("use Playwright
// para macheck mo yung mga happenings sa local library"), this is the
// monitoring/observation layer so the AWS CI/CD deploy can be cross-checked
// against a known-good local probe.

import { chromium } from '../Codebase/Frontend/node_modules/playwright/index.mjs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const BASE = 'http://127.0.0.1:3001';
const OUT = path.join(ROOT, 'test-artifacts', 'feature-sweep');

const findings = [];
function pass(area, note) { findings.push({ status: 'OK',   area, note: note || '' }); }
function warn(area, note) { findings.push({ status: 'WARN', area, note }); }
function fail(area, note) { findings.push({ status: 'FAIL', area, note }); }

async function ensureDir(d) { await fs.mkdir(d, { recursive: true }); }

async function main() {
  await ensureDir(OUT);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const pageErrors = [];
  ctx.on('weberror', (e) => pageErrors.push(e.error.message));
  ctx.on('requestfailed', (req) => {
    const url = req.url();
    if (url.startsWith(BASE) || url.includes('/api/')) {
      pageErrors.push(`reqfail ${req.method()} ${url} - ${req.failure()?.errorText}`);
    }
  });

  const page = await ctx.newPage();

  // ---- 1. PUBLIC MARKETING SURFACES ----
  const marketing = [
    { name: 'Home',         url: '/',           expect: 'nt-home' },
    { name: 'How it works', url: '/mechanics',  expect: 'nt-mech' },
    { name: 'Why',          url: '/why',        expect: 'nt-why' },
    { name: 'Patterns',     url: '/patterns',   expect: 'nt-patterns' },
    { name: 'Tour',         url: '/tour',       expect: 'nt-tour' },
    { name: 'Research',     url: '/research',   expect: 'nt-research' },
    { name: 'About',        url: '/about',      expect: 'nt-about' },
    { name: 'Learn (hub)',  url: '/student-learning', expect: 'nt-student' },
  ];
  for (const m of marketing) {
    pageErrors.length = 0;
    try {
      await page.goto(`${BASE}${m.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      const hit = await page.locator(`.${m.expect}, [class*="${m.expect}"]`).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hit) { fail(`Marketing/${m.name}`, `Expected .${m.expect} not visible at ${m.url}`); continue; }
      if (pageErrors.length > 0) {
        warn(`Marketing/${m.name}`, `Loaded but with ${pageErrors.length} error(s): ${pageErrors[0]}`);
      } else {
        pass(`Marketing/${m.name}`);
      }
    } catch (err) {
      fail(`Marketing/${m.name}`, err.message);
    }
  }

  // ---- 2. AUTH + STUDIO ENTRY ----
  pageErrors.length = 0;
  try {
    const accountsRes = await ctx.request.get(`${BASE}/auth/test-accounts`);
    if (!accountsRes.ok()) { fail('Auth/test-accounts', `status=${accountsRes.status()}`); }
    const body = await accountsRes.json();
    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      fail('Auth/test-accounts', 'no seeded test accounts (SEED_TEST_USERS=1 missing?)');
    } else {
      pass('Auth/test-accounts', `${body.accounts.length} seats`);
      const target = body.accounts.find(a => !a.claimed) || body.accounts[0];
      const claimRes = await ctx.request.post(`${BASE}/auth/claim`, { data: { username: target.username } });
      if (!claimRes.ok()) {
        fail('Auth/claim', `status=${claimRes.status()}`);
      } else {
        const claim = await claimRes.json();
        pass('Auth/claim', `claimed ${target.username}`);
        await page.addInitScript(({ token, user }) => {
          localStorage.setItem('nt_token', token);
          localStorage.setItem('nt_user', JSON.stringify(user));
          sessionStorage.setItem('nt-entry-flow', 'developer');
          localStorage.setItem('nt_start_here_dismissed', '1');
          for (const tab of ['submit', 'annotated', 'gdb', 'docs', 'ambiguous']) {
            localStorage.setItem(`nt_studio_tour_completed__${tab}`, '1');
          }
        }, { token: claim.token, user: claim.user });
      }
    }
  } catch (err) { fail('Auth', err.message); }

  // ---- 3. STUDIO TABS ----
  try {
    await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle' });
    if (!(await page.locator('#load-sample-btn').isVisible().catch(() => false))) {
      fail('Studio/entry', '#load-sample-btn not visible after navigate');
    } else { pass('Studio/entry'); }

    // Fill with builder sample
    const src = await fs.readFile(
      path.join(ROOT, 'Codebase/Microservice/samples/builder/http_request_builder.cpp'), 'utf8');
    await page.locator('textarea').first().fill(src);
    await page.locator('#analyze-btn').click();
    try {
      await page.waitForSelector('#status-title:has-text("Analysis ready")', { timeout: 30_000 });
      const patternCount = await page.locator('.class-tree-name').count().catch(() => 0);
      if (patternCount === 0) {
        warn('Studio/analyze', 'Analysis returned 0 classes (microservice likely unavailable locally)');
      } else {
        pass('Studio/analyze', `${patternCount} class(es) tagged`);
      }
    } catch (err) {
      fail('Studio/analyze', err.message);
    }

    // Tests tab
    try {
      await page.locator('button[role="tab"]:has-text("Tests")').click();
      const trophy = await page.locator('.gdb-trophy-banner').isVisible({ timeout: 5_000 }).catch(() => false);
      pass('Studio/Tests tab', trophy ? 'trophy banner rendered' : 'tab opened (no trophy banner)');
      const runAll = page.locator('button:has-text("Run all tests")').first();
      if (await runAll.isVisible().catch(() => false)) {
        const enabled = await runAll.isEnabled();
        const title = await runAll.getAttribute('title');
        if (enabled) {
          await runAll.click();
          await page.waitForTimeout(2500);
          const rows = await page.locator('.gdb-phase-row').count();
          if (rows === 0) {
            fail('Studio/Run All', 'Click fired but 0 phase rows after 2.5s — silent failure');
          } else {
            const noTpl = await page.locator('.gdb-phase-no_template, [data-status="no_template"]').count();
            pass('Studio/Run All', `${rows} phase row(s); ${noTpl} no_template/diagnostic`);
          }
        } else {
          warn('Studio/Run All', `disabled (title=${title})`);
        }
      }
    } catch (err) { fail('Studio/Tests', err.message); }

    // Docs tab
    try {
      await page.locator('button[role="tab"]:has-text("Docs")').click();
      const guide = await page.locator('.docs-read-guide').isVisible({ timeout: 5_000 }).catch(() => false);
      const banner = await page.locator('.docs-source-banner').isVisible({ timeout: 2_000 }).catch(() => false);
      if (guide && banner) {
        pass('Studio/Docs tab', 'guide + source banner visible');
      } else if (guide) {
        warn('Studio/Docs tab', 'guide visible but no docs banner (empty run)');
      } else {
        warn('Studio/Docs tab', 'docs guide not visible');
      }
    } catch (err) { fail('Studio/Docs', err.message); }

    // Patterns tab
    try {
      await page.locator('button[role="tab"]:has-text("Patterns")').click();
      const tree = await page.locator('.class-tree-view').isVisible({ timeout: 5_000 }).catch(() => false);
      if (tree) pass('Studio/Patterns tab');
      else warn('Studio/Patterns tab', 'class tree empty (no tagged classes)');
    } catch (err) { fail('Studio/Patterns', err.message); }
  } catch (err) {
    fail('Studio', err.message);
  }

  await ctx.close();
  await browser.close();

  // ---- Report ----
  const okCount   = findings.filter(f => f.status === 'OK').length;
  const warnCount = findings.filter(f => f.status === 'WARN').length;
  const failCount = findings.filter(f => f.status === 'FAIL').length;
  const report = [
    '# Local Feature Sweep',
    `Run: ${new Date().toISOString()}`,
    `Backend: ${BASE}`,
    '',
    `Summary: ${okCount} OK | ${warnCount} WARN | ${failCount} FAIL`,
    '',
    '| Status | Area | Note |',
    '|--------|------|------|',
    ...findings.map(f => `| ${f.status} | ${f.area} | ${f.note} |`),
  ].join('\n');
  await fs.writeFile(path.join(OUT, 'report.md'), report);
  console.log('\n' + report);
  console.log('\nArtifacts: ' + OUT);

  process.exitCode = failCount > 0 ? 1 : 0;
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
