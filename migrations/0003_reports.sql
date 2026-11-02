-- Bug reports and ideas sent from the in-app form. Read with `npm run feedback`.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  type TEXT NOT NULL,            -- bug, idea, other
  message TEXT NOT NULL,
  contact TEXT,                  -- optional, only to reply
  context TEXT,                  -- optional: the question and verdict it was about
  page TEXT,                     -- home, verdict, about, accuracy
  device TEXT,                   -- phone or laptop
  client_id TEXT NOT NULL,       -- hashed, only for the anti-spam limit
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS reports_client_at ON reports (client_id, at);
