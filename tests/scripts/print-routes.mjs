#!/usr/bin/env node
// Pretty-prints tests/routes.manifest.json into a markdown table.
// CI workflows pipe this into $GITHUB_STEP_SUMMARY so the job summary
// shows exactly which routes are covered and where any failure landed.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, '..', 'routes.manifest.json');

const raw = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

const lines = [];
lines.push('## Routes manifest coverage');
lines.push('');
lines.push(`Base URL: \`${manifest.baseUrl}\``);
lines.push('');
lines.push('| Path | Name | Auth | Expect status | Selector |');
lines.push('|------|------|------|----------------|----------|');
for (const r of manifest.routes ?? []) {
  lines.push(
    `| \`${r.path}\` | ${r.name} | ${r.auth} | ${r.expectStatus} | \`${r.expectSelector}\` |`
  );
}
lines.push('');
console.log(lines.join('\n'));
