import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const configuredPath = process.env.DB_PATH;
const dbPath = configuredPath
  ? (path.isAbsolute(configuredPath) ? configuredPath : path.join(__dirname, '..', '..', configuredPath))
  : path.join(__dirname, 'database.sqlite');

const db: DatabaseType = new Database(dbPath);

export = db;
