const Database = require('better-sqlite3');
const path = require('path');

// Dual-mode dispatch: tester and actual run against ISOLATED SQLite files.
// Mode resolution order:
//   1. explicit `DB_PATH` env (absolute or relative-to-Backend/) wins for any mode.
//   2. otherwise NEOTERRITORY_MODE=tester|actual picks database.<mode>.sqlite.
//   3. fallback to database.sqlite for backward compatibility.
const MODE = (process.env.NEOTERRITORY_MODE || 'tester').toLowerCase();
const VALID_MODES = new Set(['tester', 'actual']);
const resolvedMode = VALID_MODES.has(MODE) ? MODE : 'tester';

const configuredPath = process.env.DB_PATH;
let dbPath;
if (configuredPath) {
  dbPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(__dirname, '..', '..', configuredPath);
} else {
  dbPath = path.join(__dirname, `database.${resolvedMode}.sqlite`);
}

const db = new Database(dbPath);
db.mode = resolvedMode;
db.dbPath = dbPath;
module.exports = db;
