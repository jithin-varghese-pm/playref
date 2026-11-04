-- Playref-voice (Aoede) recordings of saved AI answers, so each answer is voiced once and replayed after.
-- audio is NULL while the recording is being made (so two players never pay for the same clip).
CREATE TABLE IF NOT EXISTS voice_clips (
  key TEXT PRIMARY KEY,   -- voiceKey(spoken text): the voice id plus the exact words
  audio BLOB,             -- WAV, 24 kHz mono
  created_at INTEGER NOT NULL
);
