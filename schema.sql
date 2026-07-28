-- Cloudflare D1 schema for the member portal
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  twofa_secret  TEXT,
  twofa_enabled INTEGER NOT NULL DEFAULT 0,
  plan          TEXT    NOT NULL DEFAULT 'Free',
  plan_status   TEXT    NOT NULL DEFAULT 'Active',
  plan_renews   TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  label       TEXT    NOT NULL,
  amount      TEXT,
  r2_key      TEXT    NOT NULL,
  original    TEXT    NOT NULL,
  uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
