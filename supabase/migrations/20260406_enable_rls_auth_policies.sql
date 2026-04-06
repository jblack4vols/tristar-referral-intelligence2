-- Enable Row Level Security on all tables
-- Only authenticated users can read/write data

-- datasets table
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read datasets"
  ON datasets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert datasets"
  ON datasets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete datasets"
  ON datasets FOR DELETE
  USING (auth.role() = 'authenticated');

-- cases table
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cases"
  ON cases FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cases"
  ON cases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete cases"
  ON cases FOR DELETE
  USING (auth.role() = 'authenticated');

-- processed_kpis table
ALTER TABLE processed_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read processed_kpis"
  ON processed_kpis FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert processed_kpis"
  ON processed_kpis FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete processed_kpis"
  ON processed_kpis FOR DELETE
  USING (auth.role() = 'authenticated');

-- NOTE: After applying this migration, create a user in Supabase Auth:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter email and password for authorized staff
-- 4. The app login screen will use these credentials
