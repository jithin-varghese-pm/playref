-- Questions Playref could not answer, kept to find gaps and turn them into new checked answers.
-- Only the question text (with phone numbers and emails blanked out). Nothing about the person.
CREATE TABLE IF NOT EXISTS unanswered (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  question TEXT NOT NULL,
  outcome TEXT NOT NULL,        -- not_sure, classic_only, uno_only
  rules_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS unanswered_at ON unanswered (at);
