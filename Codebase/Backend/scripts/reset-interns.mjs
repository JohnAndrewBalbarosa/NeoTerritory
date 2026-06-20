// One-time maintenance: RESET an intern's learning data so they can take the
// pre-test and modules again — WITHOUT deleting their account or the PM's plan.
//
// Clears the learning footprint (formal pre/post-test attempts + answers,
// learning progress, in-module question results + exam attempts) for the named
// interns. Keeps: the users row (they log back in with the same account), and
// learning_plans / learning_plan_modules (the PM's project-relevant assignment).
//
// SAFE BY DEFAULT: dry run (prints what it WOULD clear, then rolls back) unless
// you pass --yes. With --yes it first copies the SQLite file to a timestamped
// .bak, then commits.
//
// Foreign-key enforcement is disabled for the wipe (same reason as the in-app
// delete: avoids SQLITE_MISMATCH "datatype mismatch" from ON DELETE cascades on
// a migrated DB) and restored afterward. Every row is removed explicitly by
// user_id, so nothing is orphaned.
//
// Usage (run WHERE the production DB lives, e.g. SSH'd into the Lightsail host):
//   node scripts/reset-interns.mjs KerbySantos_cdbb8f PrintingCat_7c71b3 paulbadilla_f51eb1
//   node scripts/reset-interns.mjs --yes KerbySantos_cdbb8f PrintingCat_7c71b3 paulbadilla_f51eb1
//   DB_PATH=/path/to/database.sqlite node scripts/reset-interns.mjs --yes <usernames...>
//   node scripts/reset-interns.mjs --db /path/to/database.sqlite --yes <usernames...>
//
// Names are matched against users.username (exact). An intern with role != 'user'
// is skipped (this never touches admin/guest accounts).

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--yes');
const dbArgIdx = argv.indexOf('--db');
const dbArg = dbArgIdx >= 0 ? argv[dbArgIdx + 1] : undefined;
// Positional args that aren't flags or the --db value = the intern usernames.
const names = argv.filter((a) => !a.startsWith('--') && a !== dbArg);

if (names.length === 0) {
  console.error('✖ Provide at least one intern username. Example:\n  node scripts/reset-interns.mjs KerbySantos_cdbb8f PrintingCat_7c71b3 paulbadilla_f51eb1');
  process.exit(1);
}

const configured = dbArg ?? process.env.DB_PATH;
const dbPath = configured
  ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured))
  : path.join(__dirname, '..', 'src', 'db', 'database.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error(`✖ Database not found at: ${dbPath}`);
  process.exit(1);
}

console.log(`Database : ${dbPath}`);
console.log(`Mode     : ${COMMIT ? 'COMMIT (will clear)' : 'DRY RUN (no changes)'}`);
console.log(`Interns  : ${names.join(', ')}\n`);

const db = new Database(dbPath);

// The learning footprint to clear (keep account + plan). Order is child-first;
// with FK off it doesn't matter, but it stays correct if FK is on too.
const RESET_TABLES = [
  'learning_assessment_answers',
  'learning_assessment_attempts',
  'learning_question_results',
  'learning_exam_attempts',
  'learning_progress',
];

const existing = new Set(
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name),
);

// Resolve each name → an intern (role='user'). Report misses.
const found = [];
for (const name of names) {
  const u = db.prepare(`SELECT id, username, email, role FROM users WHERE username = ?`).get(name);
  if (!u) { console.log(`  ⚠ ${name}: no user found — skipped`); continue; }
  if (u.role !== 'user') { console.log(`  ⚠ ${name}: role='${u.role}' (not an intern) — skipped`); continue; }
  found.push(u);
}
if (found.length === 0) {
  console.log('\nNo matching intern accounts to reset. Nothing to do.');
  db.close();
  process.exit(0);
}

console.log(`\nResetting ${found.length} intern(s):`);
for (const u of found) console.log(`  #${u.id}  ${u.username}  <${u.email ?? ''}>`);
console.log('');

if (COMMIT) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${dbPath}.bak-${stamp}`;
  fs.copyFileSync(dbPath, backup);
  console.log(`Backup   : ${backup}\n`);
}

const ids = found.map((u) => u.id);
const placeholders = ids.map(() => '?').join(',');
const rowsByTable = {};

const tx = db.transaction(() => {
  for (const table of RESET_TABLES) {
    if (!existing.has(table)) continue;
    const info = db.prepare(`DELETE FROM ${table} WHERE user_id IN (${placeholders})`).run(...ids);
    if (info.changes) rowsByTable[table] = info.changes;
    console.log(`  ${table.padEnd(34)} rows cleared: ${info.changes}`);
  }
  if (!COMMIT) throw { __dryRun: true };
});

// Disable FK enforcement around the wipe (see header) and restore after.
const fkOn = db.pragma('foreign_keys', { simple: true }) === 1;
if (fkOn) db.pragma('foreign_keys = OFF');
try {
  tx();
  console.log(`\n✔ Committed. Cleared: ${JSON.stringify(rowsByTable)}`);
  console.log('  Accounts and PM plans were kept. These interns can now sign back in and retake the pre-test + modules from scratch.');
} catch (e) {
  if (e && e.__dryRun) {
    console.log(`\n↩ DRY RUN complete — rolled back, no changes written.`);
    console.log(`  Re-run with --yes to actually clear (a .bak copy is made first).`);
  } else {
    console.error('\n✖ Failed, transaction rolled back:', e);
    if (fkOn) db.pragma('foreign_keys = ON');
    db.close();
    process.exit(1);
  }
} finally {
  if (fkOn) db.pragma('foreign_keys = ON');
}

db.close();
