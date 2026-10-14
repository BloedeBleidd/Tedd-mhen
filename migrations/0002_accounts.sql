CREATE TABLE auth_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_accounts(user_id) ON DELETE CASCADE,
  account_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_legacy_reservations (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT
);
-- Reserve legacy identities before public registration opens. Duplicate emails fail migration
-- for explicit review rather than silently merging separate journals.
INSERT INTO auth_legacy_reservations(email, user_id)
  SELECT lower(email), id FROM users WHERE id <> 'local-developer';
