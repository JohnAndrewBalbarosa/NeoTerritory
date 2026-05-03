#!/usr/bin/env node
/* eslint-disable no-console */
// NeoTerritory scraper — host process.
//
// Spawned by the backend (POST /api/admin/scraper/start). Opens a headed
// Playwright Chromium window, injects tools/scraper/overlay.js, and waits
// for the user to drive the picker. Extraction is triggered from the
// in-page panel via the Playwright bindings exposed below.
//
// All output goes under playwright-scratch/scraper-output/<run_id>/. The
// directory is gitignored.
//
// Args: --url <url> --run-id <id> [--host-key <key>] [--max-scrolls <n>]
// Stdout: line-delimited JSON status events (consumed by scraperService.ts).

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PW_PATH = resolve(ROOT, 'Codebase', 'Frontend', 'node_modules', 'playwright');
const require = createRequire(import.meta.url);
const { chromium } = require(PW_PATH);

const args = parseArgs(process.argv.slice(2));
if (!args.url || !args['run-id']) {
  console.error('usage: run.mjs --url <url> --run-id <id> [--host-key <k>] [--max-scrolls <n>]');
  process.exit(2);
}
const URL = args.url;
const RUN_ID = args['run-id'];
const HOST_KEY = args['host-key'] || sanitizeForFs(new URL(URL).host);

const SCRATCH = resolve(ROOT, 'playwright-scratch');
const STATE_DIR = resolve(SCRATCH, 'scraper-state', HOST_KEY);
const OUT_DIR = resolve(SCRATCH, 'scraper-output', RUN_ID);
const STATE_FILE = resolve(STATE_DIR, 'storageState.json');
const OVERLAY = readFileSync(resolve(HERE, 'overlay.js'), 'utf8');

mkdirSync(STATE_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

function emit(event, payload = {}) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), event, ...payload })}\n`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}

function sanitizeForFs(s) {
  return String(s || 'unknown').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 60);
}

async function downloadImage(page, src, postDir, idx) {
  if (!src) return null;
  try {
    const buf = await page.evaluate(
      async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ab = await r.arrayBuffer();
        return Array.from(new Uint8Array(ab));
      },
      src
    );
    const ext = (src.split('?')[0].match(/\.(jpe?g|png|webp|gif|avif)/i) || [, 'jpg'])[1].toLowerCase();
    const file = join(postDir, `${String(idx).padStart(2, '0')}.${ext === 'jpeg' ? 'jpg' : ext}`);
    writeFileSync(file, Buffer.from(buf));
    return file;
  } catch (err) {
    emit('image-fail', { src, error: String(err.message || err) });
    return null;
  }
}

(async () => {
  emit('boot', { runId: RUN_ID, hostKey: HOST_KEY, url: URL });

  const contextOpts = {
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1,
  };
  if (existsSync(STATE_FILE)) {
    contextOpts.storageState = STATE_FILE;
    emit('reuse-state', { stateFile: STATE_FILE });
  }

  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext(contextOpts);
  await context.addInitScript({ content: OVERLAY });
  const page = await context.newPage();

  // Mirror playwright-scratch/recorder.cjs viewport-realignment trick: zero
  // animations/transitions and wait for fonts so the picker bounding boxes
  // are stable.
  await context.addInitScript({
    content: `(() => {
      const css = document.createElement('style');
      css.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}';
      document.documentElement.appendChild(css);
    })();`,
  });

  await page.exposeBinding('__neoScraper', async ({ page: p }, action, payload) => {
    if (action === 'saveState') {
      try {
        const state = await context.storageState();
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        emit('state-saved', { stateFile: STATE_FILE });
        return true;
      } catch (err) {
        emit('state-save-fail', { error: String(err.message || err) });
        return false;
      }
    }
    if (action === 'runExtract') {
      const res = await runExtract(p, payload);
      emit('extract-done', res);
      return res;
    }
    return null;
  }, { handle: false });

  // Bridge: the overlay calls window.__neoScraper.X(args). exposeBinding gave us
  // a callback that takes (action, payload), so wrap it in the page so the
  // overlay's call shape `__neoScraper.saveState()` / `__neoScraper.runExtract(args)` works.
  await page.addInitScript(() => {
    const raw = window.__neoScraper;
    if (typeof raw === 'function') {
      window.__neoScraper = {
        saveState: () => raw('saveState', null),
        runExtract: (payload) => raw('runExtract', payload),
      };
    }
  });

  page.on('close', () => {
    emit('page-closed');
    void browser.close().then(() => process.exit(0));
  });
  process.on('SIGINT', () => browser.close().then(() => process.exit(0)));
  process.on('SIGTERM', () => browser.close().then(() => process.exit(0)));

  emit('navigating', { url: URL });
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    emit('nav-fail', { error: String(err.message || err) });
  }
  emit('ready', { runId: RUN_ID, outputDir: OUT_DIR });

  async function runExtract(p, payload) {
    const picks = Array.isArray(payload?.picks) ? payload.picks : [];
    const maxScrolls = Math.max(0, Math.min(50, Number(payload?.maxScrolls ?? 5)));
    const sourceUrl = String(payload?.sourceUrl || URL);

    for (let i = 0; i < maxScrolls; i += 1) {
      await p.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
      await sleep(900);
    }

    const posts = [];
    for (let i = 0; i < picks.length; i += 1) {
      const pick = picks[i];
      const postDir = join(OUT_DIR, String(i + 1).padStart(3, '0'));
      mkdirSync(postDir, { recursive: true });
      const data = await p.evaluate((id) => {
        const el = document.querySelector(`[data-neo-pick-id="${id}"]`);
        if (!el) return null;
        const text = (el.innerText || '').trim();
        const imgs = Array.from(el.querySelectorAll('img,picture source')).map((node) => {
          if (node.tagName === 'IMG') return node.currentSrc || node.src || '';
          return node.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] || '';
        }).filter(Boolean);
        return { text, imgs };
      }, pick.id);
      if (!data) continue;

      let imagesToFetch = [];
      if (pick.imageScope === 'profile') {
        imagesToFetch = data.imgs.slice(0, 1);
      } else if (pick.imageScope === 'all') {
        imagesToFetch = data.imgs;
      }
      const imagePaths = [];
      for (let j = 0; j < imagesToFetch.length; j += 1) {
        const f = await downloadImage(p, imagesToFetch[j], postDir, j + 1);
        if (f) imagePaths.push(f.replace(ROOT + '\\', '').replace(/\\/g, '/'));
      }
      writeFileSync(join(postDir, 'post.json'), JSON.stringify({
        post_index: i + 1,
        text: data.text,
        image_count: imagePaths.length,
        image_paths: imagePaths,
        image_scope: pick.imageScope,
        source_url: sourceUrl,
        picked_at: new Date().toISOString(),
        selector_path: pick.selectorPath,
      }, null, 2));
      posts.push({ post_index: i + 1, text_preview: data.text.slice(0, 120), image_count: imagePaths.length });
    }

    const summary = {
      runId: RUN_ID,
      sourceUrl,
      maxScrolls,
      postCount: posts.length,
      outputDir: OUT_DIR,
      generatedAt: new Date().toISOString(),
      posts,
    };
    writeFileSync(join(OUT_DIR, 'posts.json'), JSON.stringify(summary, null, 2));
    return summary;
  }
})().catch((err) => {
  emit('fatal', { error: String(err && err.message ? err.message : err) });
  process.exit(1);
});
