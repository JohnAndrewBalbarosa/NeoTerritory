#!/usr/bin/env node
/* eslint-disable no-console */
// NeoTerritory scraper host — local research tool.
//
// Usage:
//   npm run dev:scraper
//
// Opens a headed Chromium at about:blank. You navigate yourself. The
// overlay first asks "for whom?" (creates/reuses scraper-output/<slug>/)
// then begins the three-step picker.
//
// No --url flag. No CLI typing of websites.

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PW_PATH = resolve(ROOT, 'Codebase', 'Frontend', 'node_modules', 'playwright');

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(PW_PATH));
} catch (err) {
  console.error('Could not load Playwright from', PW_PATH);
  console.error('Install it once with:  cd Codebase/Frontend && npm install');
  console.error('Original error:', err.message || err);
  process.exit(1);
}

const SCRATCH = resolve(ROOT, 'playwright-scratch');
const OUT_ROOT = resolve(SCRATCH, 'scraper-output');
mkdirSync(OUT_ROOT, { recursive: true });

const OVERLAY = readFileSync(resolve(HERE, 'overlay.js'), 'utf8');

const SESSION = {
  personSlug: null,
  personName: null,
  personDir: null,  // scraper-output/<slug>
  runDir: null,     // scraper-output/<slug>/<runId>
  postCounter: 0,
};

function emit(event, payload = {}) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), event, ...payload })}\n`);
}

function makeRunId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function nextPostIndexInPersonDir(personDir) {
  // Resume numbering across runs for the same person so post folders
  // never collide. Walks every <runId>/NNN/ under the person.
  let max = 0;
  if (!existsSync(personDir)) return 0;
  for (const runId of readdirSync(personDir)) {
    const runPath = join(personDir, runId);
    let stat;
    try { stat = statSync(runPath); } catch { continue; }
    if (!stat.isDirectory()) continue;
    for (const entry of readdirSync(runPath)) {
      const n = Number(entry);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return max;
}

async function downloadImage(page, src, postDir, idx) {
  if (!src) return null;
  try {
    const buf = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ab = await r.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    }, src);
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
  emit('boot', { outputRoot: OUT_ROOT });

  // Pin window size and let the page viewport follow the actual OS
  // window (viewport: null) — same trick as playwright-scratch/recorder.cjs
  // so layout never disagrees with what the user sees, and the overlay
  // never gets clipped by a viewport that's bigger than the window.
  const WIN_W = Number(process.env.SCRAPER_WIDTH || 1440);
  const WIN_H = Number(process.env.SCRAPER_HEIGHT || 900);
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      `--window-size=${WIN_W},${WIN_H}`,
      '--window-position=40,40',
    ],
  });
  // viewport:null lets the page viewport follow the OS window. Playwright
  // forbids deviceScaleFactor in this mode (it inherits the OS DPR), so
  // do not pass it here.
  const context = await browser.newContext({
    viewport: null,
  });

  // Animation-zeroing init (recorder.cjs trick) so picker bounding
  // boxes are stable.
  await context.addInitScript({
    content: `(() => {
      const css = document.createElement('style');
      css.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}';
      (document.head || document.documentElement).appendChild(css);
    })();`,
  });
  await context.addInitScript({ content: OVERLAY });

  const page = await context.newPage();

  await page.exposeBinding('__neoScraper', async ({ page: p }, action, payload) => {
    if (action === 'setPerson') return setPerson(payload);
    if (action === 'runExtract') {
      const res = await runExtract(p, payload);
      emit('extract-done', res);
      return res;
    }
    return null;
  });

  await page.addInitScript(() => {
    const raw = window.__neoScraper;
    if (typeof raw === 'function') {
      window.__neoScraper = {
        setPerson: (payload) => raw('setPerson', payload),
        runExtract: (payload) => raw('runExtract', payload),
      };
    }
  });

  page.on('close', async () => {
    emit('page-closed');
    try { await browser.close(); } catch { /* ignore */ }
    process.exit(0);
  });
  process.on('SIGINT', async () => { try { await browser.close(); } catch { /* ignore */ } process.exit(0); });
  process.on('SIGTERM', async () => { try { await browser.close(); } catch { /* ignore */ } process.exit(0); });

  // about:blank — user navigates from here.
  await page.goto('about:blank').catch(() => {});
  emit('ready', { outputRoot: OUT_ROOT });
  console.log('[scraper] ready. Navigate Chromium to the page you want, then follow the overlay (top-right).');
})().catch((err) => {
  emit('fatal', { error: String(err && err.message ? err.message : err) });
  process.exit(1);
});

function setPerson(payload) {
  const slug = String(payload?.slug || '').trim() || 'unnamed';
  const name = String(payload?.name || slug);
  const personDir = resolve(OUT_ROOT, slug);
  mkdirSync(personDir, { recursive: true });
  const runId = makeRunId();
  const runDir = resolve(personDir, runId);
  mkdirSync(runDir, { recursive: true });
  SESSION.personSlug = slug;
  SESSION.personName = name;
  SESSION.personDir = personDir;
  SESSION.runDir = runDir;
  SESSION.postCounter = nextPostIndexInPersonDir(personDir);
  // Stash a tiny manifest so the folder is self-describing even if
  // the script crashes before any post lands.
  writeFileSync(join(runDir, 'run.json'), JSON.stringify({
    runId, personSlug: slug, personName: name, startedAt: new Date().toISOString(),
  }, null, 2));
  emit('person-set', { slug, name, runDir });
  return { slug, name, runDir };
}

async function runExtract(p, payload) {
  if (!SESSION.runDir) return { error: 'person not set' };
  const pickId = payload?.pickId;
  if (!pickId) return { error: 'no pickId' };
  const includeImages = !!payload?.includeImages;
  const sourceUrl = String(payload?.sourceUrl || '');
  const selectorPath = String(payload?.selectorPath || '');

  SESSION.postCounter += 1;
  const postDir = join(SESSION.runDir, String(SESSION.postCounter).padStart(3, '0'));
  mkdirSync(postDir, { recursive: true });

  // Per-immediate-child extraction. The picked element is treated as a
  // container; each direct child Element is one self-contained unit
  // (one post / card / row). Text comes from that child's own innerText
  // — DOM tags are already structurally balanced, so the browser's
  // subtree boundary is the "depth-zero" stop we want, no manual
  // <div>/</div> counter required.
  const data = await p.evaluate((id) => {
    const root = document.querySelector(`[data-neo-pick-id="${id}"]`);
    if (!root) return null;

    const collectImgs = (el) => Array.from(el.querySelectorAll('img,picture source'))
      .map((node) => {
        if (node.tagName === 'IMG') return node.currentSrc || node.src || '';
        const ss = node.getAttribute('srcset') || '';
        return ss.split(',')[0]?.trim().split(' ')[0] || '';
      })
      .filter(Boolean);

    const dedupe = (arr) => Array.from(new Set(arr));

    const childEls = Array.from(root.children).filter((c) => c.nodeType === 1);

    const children = childEls.map((c, i) => {
      const text = (c.innerText || '').trim();
      const imgs = dedupe(collectImgs(c));
      return {
        child_index: i + 1,
        tag: c.tagName.toLowerCase(),
        class_name: (c.getAttribute('class') || '').slice(0, 200),
        text,
        text_length: text.length,
        imgs,
      };
    }).filter((c) => c.text.length > 0 || c.imgs.length > 0);

    return {
      root_text_length: (root.innerText || '').trim().length,
      root_child_count: childEls.length,
      children,
    };
  }, pickId);

  if (!data) return { error: 'pick element vanished', outputDir: postDir };

  const childRecords = [];
  for (let i = 0; i < data.children.length; i += 1) {
    const c = data.children[i];
    const folderName = String(c.child_index).padStart(2, '0');
    const childDir = join(postDir, folderName);
    mkdirSync(childDir, { recursive: true });

    const imagePaths = [];
    if (includeImages) {
      for (let j = 0; j < c.imgs.length; j += 1) {
        const f = await downloadImage(p, c.imgs[j], childDir, j + 1);
        if (f) imagePaths.push(f.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/'));
      }
    }

    writeFileSync(join(childDir, 'text.txt'), c.text);
    const childPost = {
      post_index: SESSION.postCounter,
      child_index: c.child_index,
      person_slug: SESSION.personSlug,
      person_name: SESSION.personName,
      tag: c.tag,
      class_name: c.class_name,
      text: c.text,
      text_length: c.text_length,
      include_images: includeImages,
      image_count: imagePaths.length,
      image_paths: imagePaths,
      source_url: sourceUrl,
      selector_path: selectorPath,
      picked_at: new Date().toISOString(),
    };
    writeFileSync(join(childDir, 'post.json'), JSON.stringify(childPost, null, 2));
    childRecords.push({
      child_index: c.child_index,
      tag: c.tag,
      text_length: c.text_length,
      image_count: imagePaths.length,
      dir: childDir.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/'),
    });
  }

  const summary = {
    post_index: SESSION.postCounter,
    person_slug: SESSION.personSlug,
    person_name: SESSION.personName,
    mode: 'per-immediate-child',
    root_child_count: data.root_child_count,
    extracted_child_count: childRecords.length,
    children: childRecords,
    include_images: includeImages,
    source_url: sourceUrl,
    selector_path: selectorPath,
    picked_at: new Date().toISOString(),
  };
  writeFileSync(join(postDir, 'post.json'), JSON.stringify(summary, null, 2));

  return {
    postIndex: SESSION.postCounter,
    outputDir: postDir,
    childCount: childRecords.length,
    imageCount: childRecords.reduce((s, r) => s + r.image_count, 0),
    person: SESSION.personSlug,
  };
}
