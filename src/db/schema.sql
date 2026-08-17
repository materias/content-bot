CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_unique_id TEXT NOT NULL,
  phash TEXT,
  blur_score REAL,
  baker_note TEXT NOT NULL DEFAULT '',
  caption TEXT,
  quality_flag TEXT,
  quality_reason TEXT,
  draft_message_id INTEGER,
  channel_message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_state ON submissions(state);
