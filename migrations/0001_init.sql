-- Playref D1 tables. Apply with: npx wrangler d1 migrations apply playref --remote

-- One row per typed question, for the 10-an-hour limit. Old rows are deleted as new ones arrive.
CREATE TABLE IF NOT EXISTS rate_hits (
  client_id TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_hits_client_at ON rate_hits (client_id, at);

-- AI answers kept for reuse (step 2). Only answers for the current rules version are read.
CREATE TABLE IF NOT EXISTS saved_answers (
  q_key TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  no_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (q_key, rules_version)
);

-- Every "Was this answer right?" vote, for review and for growing the test set.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q_key TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  client_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  correct INTEGER NOT NULL,
  at INTEGER NOT NULL,
  UNIQUE (q_key, rules_version, client_id)
);
