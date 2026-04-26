const Database = require('better-sqlite3');
const path = require('path');
const configuredPath = process.env.DB_PATH;
const dbPath = configuredPath
  ? (path.isAbsolute(configuredPath) ? configuredPath : path.join(__dirname, '..', '..', configuredPath))
  : path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
module.exports = db;
