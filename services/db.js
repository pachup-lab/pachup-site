const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/auth.sqlite";
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

module.exports = db;
