#!/usr/bin/env node
// Theme-leak guard for the Studio light mode.
//
// WHY: in styles.css, dark is the baseline (`:root` dark tokens) and light mode
// is a set of hand-written `:root[data-theme="light"]` overrides. Any studio
// selector that paints a DARK BACKGROUND in the default (dark) scope without a
// matching light override will render dark even in light mode — the "nakalusot
// na dark" bug. This script flags exactly those: a default-scope studio rule
// whose `background`/`background-color` is a clearly-dark color, where the
// rule's key class never appears under any `[data-theme="light"]` selector.
//
// It is intentionally narrow (background only) to stay low-false-positive:
// dark TEXT is correct in light mode, and faint black overlays (alpha < 0.25)
// read fine on a light surface, so both are ignored.
//
// Zero dependencies. Exit 0 = clean, exit 1 = leaks found (prints them).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.resolve(__dirname, '..', 'Codebase', 'Frontend', 'styles.css');

// Class-name prefixes that render inside the Studio shell (/studio). A selector
// is "studio-scoped" if it contains a class whose name starts with one of these.
const STUDIO_PREFIXES = [
  'shell', 'topbar', 'brand', 'status-card', 'user-row',
  'tab-bar', 'tab-btn', 'tab-panel', 'tab-next', 'tab-annotated', 'tab-empty',
  'studio-subview', 'subview',
  'analysis-form', 'sample-picker', 'sample-',
  'results', 'src-', 'source-', 'class-', 'classtree', 'class-tree', 'class-nav', 'class-bindings',
  'pattern', 'legend', 'tag-progress', 'tag-',
  'docs-', 'gdb-', 'ambig', 'review-', 'survey', 'pretest', 'signout',
  'modal', 'save-prompt', 'cc-excerpt', 'ai-pill', 'ai-commentary',
];

const TARGET_PROPS = new Set(['background', 'background-color']);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Relative luminance of an #rgb / #rrggbb hex; returns 0..1.
function hexLuminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Does a CSS value paint a clearly-dark fill? Scans every color stop (handles
// gradients). Ignores faint black overlays (alpha < 0.25) — those read fine on
// light surfaces too.
function valueHasDarkFill(value) {
  // rgb / rgba
  const rgbaRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)/g;
  let m;
  while ((m = rgbaRe.exec(value)) !== null) {
    const r = +m[1], g = +m[2], b = +m[3];
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    const isDark = r <= 70 && g <= 70 && b <= 90;
    if (isDark && a >= 0.25) return true;
  }
  // hex
  const hexRe = /#[0-9a-fA-F]{3,6}\b/g;
  while ((m = hexRe.exec(value)) !== null) {
    const lum = hexLuminance(m[0]);
    if (lum !== null && lum < 0.2) return true;
  }
  // oklch lightness
  const oklchRe = /oklch\(\s*([\d.]+)%/g;
  while ((m = oklchRe.exec(value)) !== null) {
    if (parseFloat(m[1]) < 30) return true;
  }
  return false;
}

function classTokens(selector) {
  return (selector.match(/\.[A-Za-z0-9_-]+/g) || []).map((c) => c.slice(1));
}

function isStudioSelector(selector) {
  return classTokens(selector).some((cls) =>
    STUDIO_PREFIXES.some((p) => cls.startsWith(p)),
  );
}

// Last class token in a selector — used as the "key" for light-override coverage.
function keyClass(selector) {
  const cls = classTokens(selector);
  return cls.length ? cls[cls.length - 1] : null;
}

function isLightPrelude(prelude) {
  // Strip :not(...) so `:root:not([data-theme="light"])` (a DARK-scope rule)
  // is not misread as light.
  const stripped = prelude.replace(/:not\([^)]*\)/g, '');
  return stripped.includes('[data-theme="light"]');
}

function main() {
  if (!fs.existsSync(CSS_PATH)) {
    console.error(`[theme-leak] styles.css not found at ${CSS_PATH}`);
    process.exit(2);
  }
  const raw = stripComments(fs.readFileSync(CSS_PATH, 'utf8'));

  const lightClasses = new Set(); // classes covered by any light override
  const candidates = []; // { selector, prop, value, keyClass, line }

  const stack = []; // frames: { selector, isLight }
  let buf = '';
  let line = 1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      const prelude = buf.trim();
      const parentLight = stack.length > 0 && stack[stack.length - 1].isLight;
      const isLight = parentLight || isLightPrelude(prelude);
      // Record covered classes from any light-scope selector prelude.
      if (isLight && !prelude.startsWith('@')) {
        for (const cls of classTokens(prelude)) lightClasses.add(cls);
      }
      stack.push({ selector: prelude, isLight });
      buf = '';
    } else if (ch === '}') {
      stack.pop();
      buf = '';
    } else if (ch === ';') {
      const decl = buf.trim();
      buf = '';
      const frame = stack[stack.length - 1];
      if (frame && !frame.isLight && !frame.selector.startsWith('@')) {
        const idx = decl.indexOf(':');
        if (idx > 0) {
          const prop = decl.slice(0, idx).trim().toLowerCase();
          const value = decl.slice(idx + 1).trim();
          if (
            TARGET_PROPS.has(prop) &&
            isStudioSelector(frame.selector) &&
            valueHasDarkFill(value)
          ) {
            candidates.push({
              selector: frame.selector,
              prop,
              value,
              keyClass: keyClass(frame.selector),
              line,
            });
          }
        }
      }
    } else {
      buf += ch;
    }
  }

  const leaks = candidates.filter(
    (c) => !c.keyClass || !lightClasses.has(c.keyClass),
  );

  if (leaks.length === 0) {
    console.log('[theme-leak] OK — no un-overridden dark studio backgrounds in light mode.');
    process.exit(0);
  }

  console.error(`[theme-leak] ${leaks.length} studio rule(s) paint a dark background with no light-mode override:\n`);
  for (const l of leaks) {
    console.error(`  styles.css:${l.line}  ${l.selector}`);
    console.error(`      ${l.prop}: ${l.value}`);
    console.error(`      → add a ':root[data-theme="light"] ${l.selector}' override or use a theme token.\n`);
  }
  console.error('Fix each rule so light mode stays fully light, then re-run.');
  process.exit(1);
}

main();
