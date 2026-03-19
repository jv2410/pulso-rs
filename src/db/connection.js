const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let db = null;

/**
 * Returns a singleton SQLite database connection.
 * Enables WAL mode and foreign keys on first call.
 */
function getDb() {
  if (db) return db;

  const dbPath = path.resolve(process.cwd(), config.DB_PATH);
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Closes the database connection. Useful for graceful shutdown.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
