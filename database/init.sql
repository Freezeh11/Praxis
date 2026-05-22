-- Praxis Game Tables
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- These tables store user game progress and score history.
-- Better Auth tables (user, session, account, verification) are created automatically by `npx auth migrate`.

-- User game progress (points, streak, etc.)
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY,        -- References Better Auth user.id
  points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-stage completion & best scores
CREATE TABLE IF NOT EXISTS stage_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,           -- References Better Auth user.id
  level_id INTEGER NOT NULL,
  stage_idx INTEGER NOT NULL,
  best_score REAL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, level_id, stage_idx)
);

-- Score submission history (every score ever earned)
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  level_id INTEGER NOT NULL,
  stage_idx INTEGER NOT NULL,
  steps_used INTEGER NOT NULL,
  laws_used TEXT[] NOT NULL,
  hints_used INTEGER NOT NULL,
  efficiency REAL NOT NULL,
  target_law REAL NOT NULL,
  hint_independence REAL NOT NULL,
  total REAL NOT NULL,
  earned_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stage_progress_user ON stage_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_score_history_level ON score_history(user_id, level_id, stage_idx);

-- Enable Row Level Security (permissive for now — tighten when auth RLS is set up)
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Permissive policies (the backend uses service_role key which bypasses RLS,
-- but these are needed in case the frontend queries Supabase directly)
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON stage_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON score_history FOR ALL USING (true);
