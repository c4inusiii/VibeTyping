import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = process.env.PTH_DB ?? resolve(DATA_DIR, 'hero.db');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  nickname      TEXT    NOT NULL,
  avatar        TEXT    NOT NULL DEFAULT 'neon',
  xp            INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT    NOT NULL DEFAULT 'email',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS typing_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL,
  language    TEXT    NOT NULL,
  duration_s  INTEGER NOT NULL,
  wpm         REAL    NOT NULL DEFAULT 0,
  raw_wpm     REAL    NOT NULL DEFAULT 0,
  cpm         REAL    NOT NULL DEFAULT 0,
  accuracy    REAL    NOT NULL DEFAULT 100,
  chars       INTEGER NOT NULL DEFAULT 0,
  errors       INTEGER NOT NULL DEFAULT 0,
  max_combo   INTEGER NOT NULL DEFAULT 0,
  xp_earned   INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES typing_sessions(id) ON DELETE CASCADE,
  mode       TEXT    NOT NULL,
  expected   TEXT    NOT NULL,
  pressed    TEXT    NOT NULL,
  delay_ms   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS key_errors (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_char TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key_char)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT    NOT NULL,
  unlocked_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_daily (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day            TEXT    NOT NULL,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  best_wpm       REAL    NOT NULL DEFAULT 0,
  total_xp       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON typing_sessions(user_id, finished_at);
CREATE INDEX IF NOT EXISTS idx_sessions_mode   ON typing_sessions(mode, finished_at);
CREATE INDEX IF NOT EXISTS idx_errors_user    ON error_log(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_user     ON user_daily(user_id, day);
`);

export function nowIso() {
  return new Date().toISOString();
}
