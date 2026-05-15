#!/usr/bin/env node
// -----------------------------------------------------------------------------
// release.mjs — orchestrator for a NeoTerritory release.
//
// Steps:
//   1. Read VERSION (the hybrid "X.Y.Z — YYYY-MM-DD" label).
//   2. Inspect commits since the latest v-tag (or all commits if untagged).
//   3. Compute the next SemVer bump from commit types:
//        any "feat!" / "BREAKING CHANGE"  → major
//        any "feat:"                       → minor
//        else                              → patch
//   4. Update VERSION (semver + today's date).
//   5. Run scripts/generate-changelog.mjs.
//   6. (Optional, default ON) refresh the "Latest release" block in README.md.
//   7. (Unless --no-tag) git tag v<semver> + push --tags.
//
// Flags:
//   --dry-run         print the proposed bump + regenerate outputs to a sandbox
//                     but do NOT touch VERSION, README, or push tags.
//   --bump=patch|minor|major   force a specific bump (overrides commit-derived).
//   --no-tag          regenerate outputs + bump VERSION but do not create/push a tag.
//
// Always run from repo root: `node scripts/release.mjs [flags]`.
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const VERSION_FILE = join(REPO_ROOT, 'VERSION');
const README_FILE = join(REPO_ROOT, 'README.md');
const CHANGELOG_FILE = join(REPO_ROOT, 'CHANGELOG.md');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_TAG = args.includes('--no-tag');
const FORCED_BUMP =
  (args.find((a) => a.startsWith('--bump='))?.split('=')[1]) || null;

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function todayIso() {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function readVersion() {
  const raw = readFileSync(VERSION_FILE, 'utf8').trim();
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)\s+—\s+(\d{4}-\d{2}-\d{2})$/);
  if (!match) throw new Error(`VERSION has invalid format: "${raw}"`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    date: match[4],
    raw,
  };
}

function inferBump() {
  if (FORCED_BUMP) {
    if (!['major', 'minor', 'patch'].includes(FORCED_BUMP)) {
      throw new Error(`--bump must be major|minor|patch, got "${FORCED_BUMP}"`);
    }
    return FORCED_BUMP;
  }
  // Find the latest v-tag; if none, treat as initial release (still patch by default).
  const latestTag = (() => {
    try {
      return execSync('git describe --tags --abbrev=0 --match "v*"', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  })();
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const subjects = git(`log --no-merges --format=%s ${range}`).split('\n').filter(Boolean);
  let bump = 'patch';
  for (const s of subjects) {
    if (/BREAKING CHANGE/.test(s) || /^feat!|^fix!|^refactor!/.test(s)) {
      return 'major';
    }
    if (s.startsWith('feat')) bump = bump === 'major' ? 'major' : 'minor';
  }
  return bump;
}

function nextVersion(current, bump) {
  let { major, minor, patch } = current;
  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return { major, minor, patch, semver: `${major}.${minor}.${patch}` };
}

function refreshReadmeLatestBlock() {
  if (!existsSync(README_FILE) || !existsSync(CHANGELOG_FILE)) return;
  const readme = readFileSync(README_FILE, 'utf8');
  const changelog = readFileSync(CHANGELOG_FILE, 'utf8');

  // Pull the first ## entry from CHANGELOG.md and inject it between the
  // <!-- LATEST RELEASE START --> / END markers in README.md. README owns
  // the markers; if they are missing, this is a no-op.
  const startMarker = '<!-- LATEST RELEASE START -->';
  const endMarker = '<!-- LATEST RELEASE END -->';
  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return;

  const firstEntryMatch = changelog.match(/^## .+?(?=^## |\Z)/ms);
  if (!firstEntryMatch) return;
  const block = firstEntryMatch[0].trim();

  const before = readme.slice(0, startIdx + startMarker.length);
  const after = readme.slice(endIdx);
  const next = `${before}\n\n${block}\n\n${after}`;

  if (!DRY_RUN) writeFileSync(README_FILE, next);
  console.log('[release] README "Latest release" block refreshed');
}

function main() {
  const current = readVersion();
  const bump = inferBump();
  const next = nextVersion(current, bump);
  const date = todayIso();
  const label = `${next.semver} — ${date}`;

  console.log(`[release] current : ${current.raw}`);
  console.log(`[release] bump    : ${bump}${FORCED_BUMP ? ' (forced)' : ''}`);
  console.log(`[release] next    : ${label}${DRY_RUN ? ' (dry-run)' : ''}`);

  if (!DRY_RUN) {
    writeFileSync(VERSION_FILE, label + '\n');
    console.log(`[release] wrote VERSION`);
  }

  // Regenerate CHANGELOG.md + updates.json against the new VERSION.
  execSync(`node ${join('scripts', 'generate-changelog.mjs')}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });

  refreshReadmeLatestBlock();

  if (!DRY_RUN && !NO_TAG) {
    const tag = `v${next.semver}`;
    try {
      git(`tag -a ${tag} -m "Release ${label}"`);
      console.log(`[release] created tag ${tag}`);
      console.log(`[release] push with: git push --follow-tags`);
    } catch (err) {
      console.error(`[release] tag creation failed: ${err.message}`);
      process.exit(1);
    }
  } else if (DRY_RUN) {
    console.log(`[release] (dry-run) would create tag v${next.semver}`);
  } else if (NO_TAG) {
    console.log(`[release] --no-tag set; skipping tag creation`);
  }

  console.log('[release] done.');
}

main();
