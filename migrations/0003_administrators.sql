CREATE TABLE administrators (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Grants are provisioned separately against an existing verified user ID.
-- Registration and unverified email identifiers never assign administrative privileges.
