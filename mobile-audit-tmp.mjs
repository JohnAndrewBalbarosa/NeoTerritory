// Visit each public page at three mobile widths, capture full-page
// screenshots, and report any horizontal overflow (scrollWidth >
// clientWidth) per width. Output goes under test-artifacts/mobile-audit/<width>/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.AUDIT_BASE || 'http://122.248.192.49';

// Public routes only — anything behind auth needs a live login session
// the audit cannot reproduce headless.
const ROUTES = [
  { name: 'home',           path: '/' },
  { name: 'about',          path: '/about' },
  { name: 'learn',          path: '/learn' },
  { name: 'patterns',       path: '/patterns' },
  { name: 'patterns-learn', path: '/patterns/learn' },
  { name: 'pattern-singleton', path: '/patterns/singleton' },
  { name: 'pattern-builder',   path: '/patterns/builder' },
  { name: 'pattern-decorator', path: '/patterns/decorator' },
];
const WIDTHS = [320, 375, 768];

const results = [];

const browser = await chromium.launch();
for (const w of WIDTHS) {
  const outDir = path.join(here, String(w));
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: w, height: 800 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    const url = base + r.path;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const overflowing = [];
        document.querySelectorAll('body *').forEach((el) => {
          if (el.scrollWidth > root.clientWidth + 1) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).slice(0,3).join('.') : '';
            overflowing.push(`${tag}${cls ? '.' + cls : ''} (${el.scrollWidth}px)`);
          }
        });
        return {
          docOverflow: root.scrollWidth - root.clientWidth,
          offenders: overflowing.slice(0, 8),
        };
      });
      const file = path.join(outDir, `${r.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.push({ width: w, name: r.name, url, ...overflow, file });
    } catch (e) {
      results.push({ width: w, name: r.name, url, error: e.message });
    }
  }
  await ctx.close();
}
await browser.close();

const w = (s) => process.stdout.write(s);
w(`\n${'route'.padEnd(20)} ${'w'.padEnd(5)} docOverflow  topOffenders\n`);
w('-'.repeat(100) + '\n');
for (const r of results) {
  if (r.error) {
    w(`${r.name.padEnd(20)} ${String(r.width).padEnd(5)} ERROR: ${r.error.slice(0,60)}\n`);
    continue;
  }
  const flag = r.docOverflow > 0 ? 'OVER ' : '     ';
  w(`${r.name.padEnd(20)} ${String(r.width).padEnd(5)} ${flag}${String(r.docOverflow).padEnd(5)}  ${r.offenders.join(' | ').slice(0,80)}\n`);
}
fs.writeFileSync(path.join(here, 'summary.json'), JSON.stringify(results, null, 2));
w(`\nScreenshots saved under ${here}\\<width>\\<route>.png\n`);
