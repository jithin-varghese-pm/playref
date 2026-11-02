-- Usage counter: daily totals per action. No client ids, no questions, nothing personal.
CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL,      -- India date, YYYY-MM-DD
  event TEXT NOT NULL,    -- tap, ask, share, page, vote
  key TEXT NOT NULL,      -- fight id, how a question was answered, etc.
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, key)
);
