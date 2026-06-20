// One-time maintenance script: delete intern/learner accounts (role = 'user')
// and ALL of their dependent data, in a single transaction.
//
// SAFE BY DEFAULT: runs as a DRY RUN (prints what it WOULD delete, then rolls
// back) unless you pass --yes. With --yes it first copies the SQLite file to a
// timestamped .bak, then commits and records an audit_log entry.
//
// It only ever touches rows owned by role='user' accounts. Admins ('admin'),
// project managers, and Devcon guests ('guest') are never selected.
//
// The set of tables to clean is DISCOVERED at runtime from the schema's actual
// foreign keys to users(id) (PRAGMA foreign_key_list), so it cannot drift out of
// sync with the DB: NOT NULL references are deleted, nullable references are
// nulled. analysis_runs.user_id (a non-FK column) is cleaned explicitly.
//
// Usage:
//   node scripts/delete-interns.mjs            # dry run against the default DB
//   node scripts/delete-interns.mjs --yes      # really delete (default DB)
//   node scripts/delete-interns.mjs --db /path/to/prod.sqlite --yes
//   DB_PATH=/path/to/prod.sqlite node scripts/delete-interns.mjs --yes
//
// For the live deployment, run this WHERE the production DB lives, pointing
// --db / DB_PATH at the production SQLite file.

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--yes');
const ROLE = 'user'; // interns/learners
const dbArgIdx = argv.indexOf('--db');
const dbArg = dbArgIdx >= 0 ? argv[dbArgIdx + 1] : undefined;

// Resolve DB path the same way src/db/database.ts does.
const configured = dbArg ?? process.env.DB_PATH;
const dbPath = configured
  ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured))
  : path.join(__dirname, '..', 'src', 'db', 'database.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error(`✖ Database not found at: ${dbPath}`);
  process.exit(1);
}

console.log(`Database : ${dbPath}`);
console.log(`Mode     : ${COMMIT ? 'COMMIT (will delete)' : 'DRY RUN (no changes)'}`);
console.log(`Target   : users.role = '${ROLE}'\n`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const interns = db.prepare(`SELECT id, username, email FROM users WHERE role = ?`).all(ROLE);
if (interns.length === 0) {
  console.log('No intern (role=user) accounts found. Nothing to do.');
  db.close();
  process.exit(0);
}

const internIds = interns.map((u) => u.id);
const placeholders = internIds.map(() => '?').join(',');

console.log(`Found ${interns.length} intern account(s):`);
for (const u of interns) console.log(`  #${u.id}  ${u.username}  <${u.email}>`);
console.log('');

// Discover every enforced foreign key that points at users(id).
const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  .all()
  .map((r) => r.name);

const refs = []; // { table, column, notnull }
for (const table of tables) {
  if (table === 'users') continue;
  const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  for (const fk of fks) {
    if (fk.table !== 'users') continue;
    const colInfo = cols.find((c) => c.name === fk.from);
    refs.push({ table, column: fk.from, notnull: colInfo ? !!colInfo.notnull : true });
  }
}

// Build the ordered statement plan. Child references first, users last.
const plan = [];
for (const r of refs) {
  if (r.notnull) {
    plan.push({
      label: `DELETE ${r.table} (${r.column})`,
      sql: `DELETE FROM ${r.table} WHERE ${r.column} IN (${placeholders})`,
    });
  } else {
    plan.push({
      label: `NULL   ${r.table}.${r.column}`,
      sql: `UPDATE ${r.table} SET ${r.column} = NULL WHERE ${r.column} IN (${placeholders})`,
    });
  }
}

// analysis_runs.user_id is a plain column (no enforced FK); clean it explicitly
// so we don't leave orphaned runs. Its children cascade via their own FKs.
const arHasUser = db.prepare(`PRAGMA table_info(analysis_runs)`).all().some((c) => c.name === 'user_id');
if (arHasUser) {
  plan.unshift({
    label: `DELETE analysis_runs (user_id)`,
    sql: `DELETE FROM analysis_runs WHERE user_id IN (${placeholders})`,
  });
}

// The user rows themselves, last.
plan.push({ label: `DELETE users (role='${ROLE}')`, sql: `DELETE FROM users WHERE role = '${ROLE}'` });

if (COMMIT) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${dbPath}.bak-${stamp}`;
  fs.copyFileSync(dbPath, backup);
  console.log(`Backup   : ${backup}\n`);
}

const run = db.transaction(() => {
  let total = 0;
  for (const step of plan) {
    const params = step.sql.includes('?') ? internIds : [];
    const info = db.prepare(step.sql).run(...params);
    total += info.changes;
    console.log(`  ${step.label.padEnd(42)} rows: ${info.changes}`);
  }
  if (COMMIT) {
    db.prepare(
      `INSERT INTO audit_log (actor_user_id, actor_username, action, target_kind, target_id, detail, created_at)
       VALUES (NULL, 'delete-interns.mjs', 'purge', 'users', NULL, ?, ?)`,
    ).run(
      JSON.stringify({ role: ROLE, deletedUserIds: internIds, totalRowsAffected: total }),
      new Date().toISOString(),
    );
  }
  if (!COMMIT) {
    // Abort the transaction so a dry run changes nothing.
    throw { __dryRun: true };
  }
  return total;
});

try {
  const total = run();
  console.log(`\n✔ Committed. ${total} row(s) affected across ${plan.length} statement(s).`);
} catch (e) {
  if (e && e.__dryRun) {
    console.log(`\n↩ DRY RUN complete — rolled back, no changes written.`);
    console.log(`  Re-run with --yes to actually delete (a .bak copy is made first).`);
  } else {
    console.error('\n✖ Failed, transaction rolled back:', e);
    db.close();
    process.exit(1);
  }
}

const remaining = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = ?`).get(ROLE).n;
console.log(`\nIntern accounts remaining after ${COMMIT ? 'commit' : 'dry run'}: ${remaining}`);
db.close();
