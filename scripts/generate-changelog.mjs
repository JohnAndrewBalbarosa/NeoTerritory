#!/usr/bin/env node
// -----------------------------------------------------------------------------
// generate-changelog.mjs
//
// Walks `git log` and emits two artifacts from Conventional Commit subjects:
//
//   1. CHANGELOG.md (markdown, repo root)               — for GitHub visitors
//   2. Codebase/Frontend/public/updates.json (JSON)     — for the /docs Updates UI
//
// The version label format is the project's hybrid SemVer + date:
//   "0.1.0 — 2026-05-12"
//
// Source of truth for the CURRENT label is the repo-root VERSION file.
// Historical labels are derived from `git tag` (annotated or lightweight, v*).
//
// Commit type → changelog bucket:
//   feat      → Added
//   fix       → Fixed
//   refactor  → Changed
//   docs      → Docs
//   perf      → Changed
//   chore | ci | test | style | build → Internal
//
// Edge cases handled:
//   - No tags yet: the entire history collapses into the version read from VERSION.
//   - Non-conventional commit subjects: filed under "Internal" with the raw subject.
//   - Merge commits (`Merge branch …`): skipped.
//
// Usage:
//   node scripts/generate-changelog.mjs            # write outputs
//   node scripts/generate-changelog.mjs --check    # exit 1 if outputs are stale
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const VERSION_FILE = join(REPO_ROOT, 'VERSION');
const CHANGELOG_FILE = join(REPO_ROOT, 'CHANGELOG.md');
const UPDATES_JSON = join(REPO_ROOT, 'Codebase', 'Frontend', 'public', 'updates.json');

const CHECK_MODE = process.argv.includes('--check');

// ---------- helpers ----------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function readVersion() {
  if (!existsSync(VERSION_FILE)) {
    throw new Error(`VERSION file not found at ${VERSION_FILE}`);
  }
  const raw = readFileSync(VERSION_FILE, 'utf8').trim();
  const match = raw.match(/^(\d+\.\d+\.\d+)\s+—\s+(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    throw new Error(
      `VERSION file has invalid format. Expected "X.Y.Z — YYYY-MM-DD", got "${raw}"`,
    );
  }
  return { semver: match[1], date: match[2], label: raw };
}

function listTags() {
  const out = git('tag --list "v*" --sort=-creatordate');
  if (!out) return [];
  return out.split('\n').filter(Boolean);
}

// Conventional Commit subject parser.
// Examples it accepts:
//   "feat(why+theme): flip text tokens in light mode"
//   "fix: handle null response"
//   "feat!: drop legacy endpoint"          (breaking)
//   "refactor(api): split route handlers"
const SUBJECT_RE =
  /^(?<type>feat|fix|refactor|docs|chore|ci|test|perf|style|build)(?<breaking>!)?(?:\((?<scope>[^)]+)\))?:\s+(?<subject>.+)$/;

function parseSubject(subject) {
  const m = subject.match(SUBJECT_RE);
  if (!m) return { type: 'other', scope: null, breaking: false, subject };
  return {
    type: m.groups.type,
    scope: m.groups.scope ?? null,
    breaking: m.groups.breaking === '!',
    subject: m.groups.subject,
  };
}

function bucketFor(type) {
  switch (type) {
    case 'feat':
      return 'Added';
    case 'fix':
      return 'Fixed';
    case 'refactor':
    case 'perf':
      return 'Changed';
    case 'docs':
      return 'Docs';
    case 'chore':
    case 'ci':
    case 'test':
    case 'style':
    case 'build':
    case 'other':
      return 'Internal';
    default:
      return 'Internal';
  }
}

// Read commits in a range; format: hash<TAB>subject<TAB>iso-date<TAB>body-summary
// We use --no-merges so "Merge branch …" commits never appear in the changelog.
function readCommitsInRange(range) {
  const fmt = '%H%x09%s%x09%aI';
  const raw = git(`log --no-merges --format="${fmt}" ${range}`);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, date] = line.split('\t');
      const parsed = parseSubject(subject);
      return { hash, subject, date, ...parsed };
    });
}

// Build a release entry from a list of commits.
function buildReleaseEntry({ semver, date, label, commits }) {
  const buckets = { Added: [], Fixed: [], Changed: [], Docs: [], Internal: [] };
  for (const c of commits) {
    const b = bucketFor(c.type);
    buckets[b].push(c);
  }
  return { semver, date, label, buckets };
}

// ---------- markdown emit ----------

function renderEntryMarkdown(entry) {
  const lines = [];
  lines.push(`## ${entry.label}`);
  lines.push('');
  const order = ['Added', 'Fixed', 'Changed', 'Docs', 'Internal'];
  for (const bucket of order) {
    const items = entry.buckets[bucket];
    if (items.length === 0) continue;
    lines.push(`### ${bucket}`);
    lines.push('');
    for (const c of items) {
      const scope = c.scope ? `**${c.scope}**: ` : '';
      const subj = c.subject ?? c.raw ?? '(no subject)';
      const short = c.hash.slice(0, 7);
      lines.push(`- ${scope}${subj} (${short})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderChangelog(entries) {
  const header = [
    '# Changelog',
    '',
    'All notable changes to NeoTerritory are documented here. The format follows',
    '[Keep a Changelog](https://keepachangelog.com/) loosely, but releases use a',
    'hybrid label of SemVer + ISO date (e.g. `0.1.0 — 2026-05-12`). This file is',
    'generated from Conventional Commit subjects by `scripts/generate-changelog.mjs`.',
    '',
    '',
  ];
  return header.join('\n') + entries.map(renderEntryMarkdown).join('\n');
}

// ---------- json emit ----------

function renderJson(entries) {
  // Strip git hashes' dates and keep a stable shape the website can render.
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    releases: entries.map((e) => ({
      version: e.semver,
      date: e.date,
      label: e.label,
      buckets: Object.fromEntries(
        Object.entries(e.buckets).map(([k, list]) => [
          k,
          list.map((c) => ({
            scope: c.scope,
            subject: c.subject ?? c.raw,
            hash: c.hash.slice(0, 7),
          })),
        ]),
      ),
    })),
  };
}

// ---------- main ----------

function main() {
  const current = readVersion();
  const tags = listTags();

  const entries = [];

  if (tags.length === 0) {
    // First-run: no tags yet. Collapse all history under the current VERSION label.
    const commits = readCommitsInRange('HEAD');
    entries.push(buildReleaseEntry({ ...current, commits }));
  } else {
    // Newest entry: current VERSION covers (latest tag..HEAD).
    const latest = tags[0];
    const headCommits = readCommitsInRange(`${latest}..HEAD`);
    if (headCommits.length > 0) {
      entries.push(buildReleaseEntry({ ...current, commits: headCommits }));
    }
    // Historical entries: walk tag pairs (older..newer).
    for (let i = 0; i < tags.length; i++) {
      const newer = tags[i];
      const older = tags[i + 1];
      const range = older ? `${older}..${newer}` : newer; // oldest tag covers all prior history
      const commits = readCommitsInRange(range);
      const semver = newer.replace(/^v/, '');
      // Derive the tag's date so historical labels stay stable.
      const tagDate = git(`log -1 --format=%aI ${newer}`).slice(0, 10);
      const label = `${semver} — ${tagDate}`;
      entries.push(buildReleaseEntry({ semver, date: tagDate, label, commits }));
    }
  }

  const markdown = renderChangelog(entries);
  const json = renderJson(entries);

  if (CHECK_MODE) {
    const existingMd = existsSync(CHANGELOG_FILE) ? readFileSync(CHANGELOG_FILE, 'utf8') : '';
    const existingJson = existsSync(UPDATES_JSON) ? readFileSync(UPDATES_JSON, 'utf8') : '';
    const mdStale = existingMd.trim() !== markdown.trim();
    const jsonStale = existingJson.trim() !== JSON.stringify(json, null, 2).trim();
    if (mdStale || jsonStale) {
      console.error('[changelog] outputs are stale. Run without --check to regenerate.');
      process.exit(1);
    }
    console.log('[changelog] outputs up to date.');
    return;
  }

  writeFileSync(CHANGELOG_FILE, markdown);
  const updatesDir = dirname(UPDATES_JSON);
  if (!existsSync(updatesDir)) mkdirSync(updatesDir, { recursive: true });
  writeFileSync(UPDATES_JSON, JSON.stringify(json, null, 2) + '\n');

  const total = entries.reduce((sum, e) => {
    return sum + Object.values(e.buckets).reduce((s, l) => s + l.length, 0);
  }, 0);
  console.log(`[changelog] wrote ${entries.length} release(s) totalling ${total} commit(s)`);
  console.log(`[changelog]   - ${CHANGELOG_FILE}`);
  console.log(`[changelog]   - ${UPDATES_JSON}`);
}

main();
