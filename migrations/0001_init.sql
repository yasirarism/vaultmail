CREATE TABLE IF NOT EXISTS kv_store (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS list_meta (
  id TEXT PRIMARY KEY,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_list_items_key_created ON list_items(key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kv_expires ON kv_store(expires_at);
