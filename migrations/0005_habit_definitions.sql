CREATE TABLE habit_definitions (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  PRIMARY KEY (owner_id, key)
);

-- Imports carry their own custom names. Remember them only after a successful entry write.
CREATE TRIGGER remember_inserted_habits AFTER INSERT ON entries
BEGIN
  INSERT OR IGNORE INTO habit_definitions(owner_id, key, name)
  SELECT NEW.owner_id, json_extract(value, '$.key'), json_extract(value, '$.name')
  FROM json_each(NEW.data, '$.habits')
  WHERE json_extract(value, '$.key') LIKE 'custom:%';
END;
CREATE TRIGGER remember_updated_habits AFTER UPDATE OF data ON entries
BEGIN
  INSERT OR IGNORE INTO habit_definitions(owner_id, key, name)
  SELECT NEW.owner_id, json_extract(value, '$.key'), json_extract(value, '$.name')
  FROM json_each(NEW.data, '$.habits')
  WHERE json_extract(value, '$.key') LIKE 'custom:%';
END;
