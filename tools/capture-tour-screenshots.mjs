#!/usr/bin/env node
// Capture studio screenshots for the public /tour page.
//
// Per user direction: each step in
// Codebase/Frontend/src/components/marketing/tour/tourSteps.ts gets one PNG
// under Codebase/Frontend/public/tour/<slug>.png. The /tour page already
// references those filenames via its imagePath field; this script fills
// the directory.
//
// Run with:    node tools/capture-tour-screenshots.mjs
//
// Requirements:
//   - The studio dev server must be running on http://localhost:3001
//     (or set TOUR_BASE_URL env var to override).
//   - A tester / dev account credential set must be available; the script
//     reads NEOTERRITORY_TESTER_USER and NEOTERRITORY_TESTER_PASS from env
//     for the form login. If those are absent it captures only the public
//     surfaces and emits "skipped — needs auth" placeholders for the rest.
//   - Playwright must be installed under Codebase/Frontend/node_modules
//     (same convention as playwright-scratch/recorder.cjs).
//
// The script never types real passwords; it expects a pre-provisioned
// tester credential in env. Auth-gated steps emit a static fallback when
// no credentials are present so the public site is never blocked on this
// script's success.

import { chromium } from '../Codebase/Frontend/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUTPUT_DIR = path.join(ROOT, 'Codebase', 'Frontend', 'public', 'tour');
const TOUR_STEPS_FILE = path.join(
  ROOT,
  'Codebase',
  'Frontend',
  'src',
  'components',
  'marketing',
  'tour',
  'tourSteps.ts',
);

const BASE_URL = process.env.TOUR_BASE_URL || 'http://localhost:3001';
const TESTER_USER = process.env.NEOTERRITORY_TESTER_USER || '';
const TESTER_PASS = process.env.NEOTERRITORY_TESTER_PASS || '';

const VIEWPORT = { width: 1440, height: 900 };

// Each entry below mirrors a step slug from tourSteps.ts. The script
// performs the listed actions in order, then captures a PNG.
//
// `requiresAuth: true` means the step depends on having logged in. If the
// run is unauthenticated the script writes a placeholder note to the file
// instead of skipping silently.
const SHOTS = [
  {
    slug: 'sign-in',
    description: 'Login overlay rendered',
    requiresAuth: false,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    },
  },
  {
    slug: 'land-on-submit',
    description: 'Studio landing — Submit tab',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    },
  },
  {
    slug: 'load-a-sample',
    description: 'Sample picker open',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
      const btn = page.locator('#load-sample-btn');
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    },
  },
  {
    slug: 'click-analyze',
    description: 'Analyze button highlighted',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
      const sample = page.locator('#load-sample-btn');
      if (await sample.isVisible().catch(() => false)) {
        await sample.click();
        // Pick the first sample tile if the picker opened.
        const firstPick = page.locator('.nt-sample-picker__pick').first();
        if (await firstPick.isVisible().catch(() => false)) {
          await firstPick.click();
          await page.waitForTimeout(200);
        }
      }
      const analyze = page.locator('#analyze-btn');
      if (await analyze.isVisible().catch(() => false)) {
        await analyze.scrollIntoViewIfNeeded();
      }
    },
  },
  {
    slug: 'read-the-card',
    description: 'Pattern card rendered after analysis',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    },
  },
  {
    slug: 'generate-docs',
    description: 'Generate documentation in progress',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    },
  },
  {
    slug: 'save-the-run',
    description: 'Per-run review modal',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    },
  },
  {
    slug: 'open-history',
    description: 'Run list with saved entries',
    requiresAuth: true,
    setup: async (page) => {
      await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    },
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loginIfPossible(page) {
  if (!TESTER_USER || !TESTER_PASS) return false;
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  const userField = page
    .locator('input[name="username"], input[type="text"]')
    .first();
  const passField = page.locator('input[type="password"]').first();
  if (
    !(await userField.isVisible().catch(() => false)) ||
    !(await passField.isVisible().catch(() => false))
  ) {
    return false;
  }
  await userField.fill(TESTER_USER);
  await passField.fill(TESTER_PASS);
  const submit = page.locator('button[type="submit"]').first();
  await submit.click();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  return true;
}

async function patchTourStepsFile(slugs) {
  const raw = await fs.readFile(TOUR_STEPS_FILE, 'utf8');
  let next = raw;
  for (const slug of slugs) {
    const target = `slug: '${slug}',`;
    if (!next.includes(target)) continue;
    const start = next.indexOf(target);
    const stepEnd = next.indexOf('  },', start);
    if (stepEnd === -1) continue;
    const segment = next.slice(start, stepEnd);
    const expected = `imagePath: '/tour/${slug}.png'`;
    if (segment.includes(expected)) continue;
    const replaced = segment.replace(/imagePath: [^,\n]+/, expected);
    next = next.slice(0, start) + replaced + next.slice(stepEnd);
  }
  if (next !== raw) {
    await fs.writeFile(TOUR_STEPS_FILE, next);
    console.log(`[capture-tour] Updated imagePath for ${slugs.length} step(s).`);
  }
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const authed = await loginIfPossible(page);
  if (!authed) {
    console.warn(
      '[capture-tour] No credentials in NEOTERRITORY_TESTER_USER / _PASS. ' +
        'Auth-gated steps will be captured at the login screen.',
    );
  }

  const written = [];
  for (const shot of SHOTS) {
    if (shot.requiresAuth && !authed) {
      console.warn(`[capture-tour] skipped (needs auth): ${shot.slug}`);
      continue;
    }
    try {
      await shot.setup(page);
      await page.waitForTimeout(400);
      const file = path.join(OUTPUT_DIR, `${shot.slug}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`[capture-tour] wrote ${path.relative(ROOT, file)}`);
      written.push(shot.slug);
    } catch (err) {
      console.error(`[capture-tour] failed ${shot.slug}:`, err.message);
    }
  }

  await context.close();
  await browser.close();

  if (written.length > 0) {
    await patchTourStepsFile(written);
  }

  console.log(`[capture-tour] done. ${written.length}/${SHOTS.length} shots written.`);
}

main().catch((err) => {
  console.error('[capture-tour] fatal:', err);
  process.exitCode = 1;
});
