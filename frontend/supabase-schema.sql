-- ============================================================
--  Bolão Copa 2026 — Supabase Schema
--  Execute this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. picks — user predictions (may already exist, alter adds user_name)
CREATE TABLE IF NOT EXISTS picks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email   TEXT NOT NULL,
  user_name    TEXT NOT NULL DEFAULT '',
  match_id     INTEGER NOT NULL,
  home_score   TEXT NOT NULL DEFAULT '',
  away_score   TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_email, match_id)
);

-- Add user_name if the table already existed without it
ALTER TABLE picks ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT '';

-- 2. official_results — admin sets match results
CREATE TABLE IF NOT EXISTS official_results (
  match_id   INTEGER PRIMARY KEY,
  home_score TEXT NOT NULL DEFAULT '',
  away_score TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. team_assignments — admin fills in knockout-stage team names
CREATE TABLE IF NOT EXISTS team_assignments (
  match_id  INTEGER PRIMARY KEY,
  home_team TEXT NOT NULL DEFAULT '',
  away_team TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
--  Row Level Security
--  Option A (simple, recommended for a private friend group):
--    Disable RLS on all three tables so everyone can read/write.
--
--  Option B (safer): Enable RLS and add policies below.
-- ============================================================

-- Option A — disable RLS (paste these three lines):
ALTER TABLE picks             DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_results  DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_assignments  DISABLE ROW LEVEL SECURITY;

-- Option B — enable RLS with policies (comment out Option A first):
-- ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anyone can read picks"  ON picks FOR SELECT USING (true);
-- CREATE POLICY "owner can insert picks" ON picks FOR INSERT WITH CHECK (auth.email() = user_email);
-- CREATE POLICY "owner can update picks" ON picks FOR UPDATE USING (auth.email() = user_email);
--
-- ALTER TABLE official_results ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anyone can read results"   ON official_results FOR SELECT USING (true);
-- CREATE POLICY "anyone can write results"  ON official_results FOR ALL   USING (true);  -- tighten per admin email if needed
--
-- ALTER TABLE team_assignments ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anyone can read teams"     ON team_assignments FOR SELECT USING (true);
-- CREATE POLICY "anyone can write teams"    ON team_assignments FOR ALL   USING (true);
