CREATE TABLE user_preferences (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  uses INTEGER NOT NULL DEFAULT 1 CHECK(uses >= 1),
  last_used INTEGER NOT NULL,
  PRIMARY KEY(owner_id, key)
);
