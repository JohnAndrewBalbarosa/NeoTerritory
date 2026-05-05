#!/usr/bin/env node
// generate-ops-docs.mjs — extract header + function comment blocks from the
// shell/powershell/JS tooling and emit a Markdown reference under docs/auto/.
//
// Targets:
//   start.{sh,ps1}                root entrypoints
//   ops/bash/**/*.sh              bash modules
//   ops/powershell/**/*.ps1       powershell modules
//   scripts/*.{sh,ps1,mjs}        standalone utilities
//
// Output:
//   docs/auto/README.md           index + regeneration notice
//   docs/auto/ops-bash.md         all bash files (by directory)
//   docs/auto/ops-powershell.md   all powershell files (by directory)
//   docs/auto/scripts.md          standalone scripts/ utilities
//
// Run:  npm run docs:ops
//
// Convention assumed by the parser:
//   - File header is the first contiguous run of comment lines (after the
//     shebang). Stops at the first blank or non-comment line.
//   - Function docs are the contiguous run of comment lines IMMEDIATELY
//     preceding the function definition (no blank line gap).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep, posix } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const OUT_DIR = join(ROOT, 'docs', 'auto');

// ── File discovery ─────────────────────────────────────────────────────────
function* walk(dir, exts) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, exts);
    else if (e.isFile() && exts.some(x => e.name.endsWith(x))) yield full;
  }
}

function relPath(p) { return relative(ROOT, p).split(sep).join(posix.sep); }

// ── Comment / function extraction ──────────────────────────────────────────
const COMMENT_PREFIX = {
  sh:  /^\s*#(?!!)\s?(.*)$/,        // # but not #! shebang
  ps1: /^\s*#\s?(.*)$/,
  mjs: /^\s*\/\/\s?(.*)$/,
};

const FUNC_PATTERNS = {
  // bash:  funcname() {   |   function funcname {
  sh: [/^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{/, /^\s*function\s+([A-Za-z_][\w-]*)\s*\{/],
  // powershell: function Verb-Name { ... }   |   function Verb-Name($p) { ...
  ps1: [/^\s*function\s+([A-Za-z][\w-]+)\s*[\(\{]/i],
  // mjs: function foo(...)  |  async function foo(...)  |  export function foo(...)
  mjs: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_][\w]*)\s*\(/,
    /^\s*(?:export\s+)?const\s+([A-Za-z_][\w]*)\s*=\s*(?:async\s*)?\(.*?\)\s*=>/,
  ],
};

function extKey(file) {
  if (file.endsWith('.sh')) return 'sh';
  if (file.endsWith('.ps1')) return 'ps1';
  if (file.endsWith('.mjs') || file.endsWith('.js')) return 'mjs';
  return null;
}

function parseFile(absPath) {
  const ext = extKey(absPath);
  if (!ext) return null;
  const lines = readFileSync(absPath, 'utf8').split(/\r?\n/);
  const re = COMMENT_PREFIX[ext];

  // ── header ────────────────────────────────────────────────────────────────
  let i = 0;
  while (i < lines.length && /^#!/.test(lines[i])) i++;       // skip shebang
  while (i < lines.length && lines[i].trim() === '') i++;     // skip blanks
  const header = [];
  while (i < lines.length) {
    const m = re.exec(lines[i]);
    if (!m) break;
    header.push(m[1] ?? '');
    i++;
  }

  // ── functions ─────────────────────────────────────────────────────────────
  const funcs = [];
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    let name = null;
    for (const p of FUNC_PATTERNS[ext]) {
      const fm = p.exec(line);
      if (fm) { name = fm[1]; break; }
    }
    if (!name) continue;

    // Walk backward collecting contiguous comment lines (no blank-line gap).
    const doc = [];
    for (let k = j - 1; k >= 0; k--) {
      const cm = re.exec(lines[k]);
      if (cm) doc.unshift(cm[1] ?? '');
      else break;                                              // blank or code -> stop
    }
    funcs.push({ name, line: j + 1, doc });
  }

  return { path: relPath(absPath), ext, header, funcs };
}

// ── Markdown rendering ─────────────────────────────────────────────────────
function dedentBlock(arr) {
  // Strip a single leading space introduced by `# x` / `// x` regex.
  // The regex already does this with `\s?`; this is a no-op safety pass.
  return arr.join('\n').replace(/\n+$/, '');
}

function renderFile(rec) {
  const out = [];
  out.push(`### \`${rec.path}\``);
  if (rec.header.length) {
    out.push('');
    out.push(dedentBlock(rec.header));
  }
  if (rec.funcs.length) {
    out.push('');
    out.push('**Functions**');
    out.push('');
    for (const fn of rec.funcs) {
      out.push(`- \`${fn.name}\` (line ${fn.line})`);
      const body = dedentBlock(fn.doc);
      if (body) {
        for (const ln of body.split('\n')) out.push(`  ${ln}`);
      }
    }
  }
  out.push('');
  return out.join('\n');
}

function groupByDir(records) {
  const groups = new Map();
  for (const r of records) {
    const d = posix.dirname(r.path) || '.';
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(r);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderSection(title, records) {
  if (!records.length) return '';
  const out = [`# ${title}`, '', `_Auto-generated by \`tools/generate-ops-docs.mjs\`. Do not edit by hand._`, ''];
  out.push(`Sources: ${records.length} file(s).`, '');
  for (const [dir, recs] of groupByDir(records)) {
    out.push(`## \`${dir}/\``, '');
    for (const r of recs.sort((a, b) => a.path.localeCompare(b.path))) {
      out.push(renderFile(r));
    }
  }
  return out.join('\n');
}

function renderIndex(buckets) {
  const total = Object.values(buckets).reduce((n, arr) => n + arr.length, 0);
  return [
    '# Auto-generated tooling docs',
    '',
    '_Generated by `tools/generate-ops-docs.mjs`. Do not edit — regenerate via `npm run docs:ops`._',
    '',
    `Indexed ${total} file(s) across the bash, powershell, and standalone-script surfaces.`,
    '',
    '## Sections',
    '',
    `- [Bash modules](./ops-bash.md) — ${buckets.bash.length} file(s)`,
    `- [PowerShell modules](./ops-powershell.md) — ${buckets.ps.length} file(s)`,
    `- [Standalone scripts](./scripts.md) — ${buckets.scripts.length} file(s)`,
    '',
    '## Convention',
    '',
    'The extractor recognises:',
    '',
    '1. **File header** — the first contiguous run of `#`/`//` comment lines after',
    '   the shebang. Stops at the first blank or non-comment line.',
    '2. **Function docs** — the contiguous run of comment lines _immediately_',
    '   preceding a function definition (no blank-line gap).',
    '',
    'Function definitions detected:',
    '',
    '- Bash: `name() { ... }` and `function name { ... }`',
    '- PowerShell: `function Verb-Noun { ... }` (and parameterised forms)',
    '- JS/MJS: `function name(...)`, `async function name(...)`, `export function`,',
    '  and `const name = (...) => ...`',
    '',
  ].join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const targets = {
    bash: [
      ...walk(join(ROOT, 'ops', 'bash'), ['.sh']),
      join(ROOT, 'start.sh'),
    ],
    ps: [
      ...walk(join(ROOT, 'ops', 'powershell'), ['.ps1']),
      join(ROOT, 'start.ps1'),
    ],
    scripts: [...walk(join(ROOT, 'scripts'), ['.sh', '.ps1', '.mjs'])],
  };

  const buckets = {
    bash:    targets.bash.map(parseFile).filter(Boolean),
    ps:      targets.ps.map(parseFile).filter(Boolean),
    scripts: targets.scripts.map(parseFile).filter(Boolean),
  };

  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => a.path.localeCompare(b.path));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'README.md'),         renderIndex(buckets));
  writeFileSync(join(OUT_DIR, 'ops-bash.md'),       renderSection('Bash modules',           buckets.bash));
  writeFileSync(join(OUT_DIR, 'ops-powershell.md'), renderSection('PowerShell modules',     buckets.ps));
  writeFileSync(join(OUT_DIR, 'scripts.md'),        renderSection('Standalone scripts',     buckets.scripts));

  const totalFns = [...buckets.bash, ...buckets.ps, ...buckets.scripts]
    .reduce((n, r) => n + r.funcs.length, 0);
  console.log(`docs:ops -> wrote ${Object.keys(buckets).length + 1} files to docs/auto/`);
  console.log(`  bash:        ${buckets.bash.length} file(s)`);
  console.log(`  powershell:  ${buckets.ps.length} file(s)`);
  console.log(`  scripts:     ${buckets.scripts.length} file(s)`);
  console.log(`  functions:   ${totalFns}`);
}

main();
