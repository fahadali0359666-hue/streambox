CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('mux','direct')),
  playback_id TEXT,
  stream_url TEXT,
  rights_status TEXT NOT NULL CHECK (rights_status IN ('licensed','public_domain')),
  license_source TEXT NOT NULL,
  license_reference TEXT,
  territory TEXT DEFAULT 'WORLD',
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  reference TEXT NOT NULL,
  territory TEXT DEFAULT 'WORLD',
  starts_at TEXT,
  ends_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_streams_catalog ON streams(catalog_id);
CREATE INDEX IF NOT EXISTS idx_license_catalog ON license_records(catalog_id);
