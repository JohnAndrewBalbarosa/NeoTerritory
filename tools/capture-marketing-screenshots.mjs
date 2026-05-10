#!/usr/bin/env node
// Capture marketing-surface screenshots using vite preview as a backend-free
// server. Per user direction: use Playwright for pictures wherever
// possible. This script captures the public marketing pages (which need no
// backend, no microservice, no Docker) so the project has press-kit-quality
// PNGs for /how-it-works (=/mechanics), /patterns, /tour, etc.
//
// Companion to tools/capture-tour-screenshots.mjs, which captures the
// auth-gated STUDIO surfaces and needs the full studio stack running.
//
// Run with:    node tools/capture-marketing-screenshots.mjs
//
// What it does:
//   1. Spawns `npx vite preview` from Codebase/Frontend so the built dist/
//      gets served at http://localhost:4173 (Vite's default preview port).
//   2. Waits for the preview server to answer.
//   3. Drives Chromium to each public route and writes one PNG per surface
//      to Codebase/Frontend/public/preview/.
//   4. Tears down the preview server.
//
// Requirements:
//   - The Vite build has already produced Codebase/Frontend/dist/ (run
//     `npx vite build` first, or use `npm run build`).
//   - Playwright is resolvable from Codebase/Frontend/node_modules
//     (same convention as tools/capture-tour-screenshots.mjs).

import { chromium } from '../Codebase/Frontend/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const FRONTEND_DIR = path.join(ROOT, 'Codebase', 'Frontend');
const OUTPUT_DIR = path.join(FRONTEND_DIR, 'public', 'preview');
const PREVIEW_PORT = Number(process.env.VITE_PREVIEW_PORT || 4173);
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const VIEWPORT = { width: 1440, height: 900 };

// One entry per marketing surface. `name` becomes the PNG filename
// (`<name>.png`). `fullPage: true` captures the entire scroll height; some
// pages get a shorter capture by setting `fullPage: false`.
const SHOTS = [
  { name: 'home',      path: '/',           fullPage: true,  label: 'Home' },
  { name: 'mechanics', path: '/mechanics',  fullPage: true,  label: 'How it works' },
  { name: 'why',       path: '/why',        fullPage: false, label: 'Why this matters' },
  { name: 'patterns',  path: '/patterns',   fullPage: true,  label: 'Pattern catalog' },
  { name: 'patterns-singleton', path: '/patterns/singleton', fullPage: true,  label: 'Pattern detail (Singleton)' },
  { name: 'tour',      path: '/tour',       fullPage: true,  label: 'Tour' },
  { name: 'research',  path: '/research',   fullPage: true,  label: 'Research' },
  { name: 'about',     path: '/about',      fullPage: true,  label: 'About' },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Lightweight HEAD-ish: try fetching root, accept any 2xx/3xx.
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || (res.status >= 200 && res.status < 400)) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startPreview() {
  console.log(`[capture-marketing] starting "npx vite preview" on :${PREVIEW_PORT}`);
  // --port forces the port; --strictPort fails fast if held; --host
  // 127.0.0.1 keeps the preview local-only.
  const child = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: FRONTEND_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    },
  );
  child.stdout.on('data', (b) => process.stdout.write(`[preview] ${b}`));
  child.stderr.on('data', (b) => process.stderr.write(`[preview!] ${b}`));
  return child;
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  // Verify dist/ exists; if not, instruct the user.
  const distDir = path.join(FRONTEND_DIR, 'dist');
  try {
    await fs.access(distDir);
  } catch {
    console.error(`[capture-marketing] No build at ${distDir}.`);
    console.error('[capture-marketing] Run `npx vite build` from Codebase/Frontend first.');
    process.exitCode = 1;
    return;
  }

  const preview = startPreview();

  const ok = await waitForServer(PREVIEW_URL);
  if (!ok) {
    console.error(`[capture-marketing] preview server did not come up at ${PREVIEW_URL}`);
    preview.kill('SIGTERM');
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // crisper screenshots for press kit
  });
  const page = await context.newPage();

  let written = 0;
  for (const shot of SHOTS) {
    const target = `${PREVIEW_URL}${shot.path}`;
    try {
      await page.goto(target, { waitUntil: 'networkidle' });
      // Give scroll-driven indicators and IntersectionObserver-based UIs a
      // moment to settle on top-of-page state.
      await page.waitForTimeout(500);
      const file = path.join(OUTPUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: shot.fullPage });
      console.log(`[capture-marketing] wrote ${path.relative(ROOT, file)} (${shot.label})`);
      written += 1;
    } catch (err) {
      console.error(`[capture-marketing] failed ${shot.path}: ${err.message}`);
    }
  }

  await context.close();
  await browser.close();

  preview.kill('SIGTERM');
  // Give Vite a moment to shut down before exiting so its post-quit message
  // does not interleave with our final summary.
  await new Promise((r) => setTimeout(r, 300));

  console.log(`[capture-marketing] done. ${written}/${SHOTS.length} shots written.`);
}

main().catch((err) => {
  console.error('[capture-marketing] fatal:', err);
  process.exitCode = 1;
});
