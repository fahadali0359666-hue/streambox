CREATE TABLE IF NOT EXISTS provider_settings (
  provider TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_encrypted TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_settings_enabled
  ON provider_settings(enabled);
