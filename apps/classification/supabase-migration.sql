-- ============================================================
-- Supabase Migration: Create classifications table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Classifications table: stores all emergency classification records
CREATE TABLE classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('conflict', 'outbreak', 'food', 'hazard')),
  country TEXT NOT NULL,
  region TEXT,
  emergency_name TEXT NOT NULL,
  date DATE,
  expiration_date DATE,
  processing_speed TEXT,
  reclassification_number INTEGER DEFAULT 1,
  previous_severity INTEGER,
  metrics JSONB DEFAULT '{}',
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  stance TEXT NOT NULL CHECK (stance IN ('white', 'yellow', 'orange', 'red')),
  notes TEXT,
  confidence JSONB,
  subnational JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns (Albert queries, dashboard filters)
CREATE INDEX idx_classifications_stance ON classifications (stance);
CREATE INDEX idx_classifications_country ON classifications (country);
CREATE INDEX idx_classifications_date ON classifications (date);
CREATE INDEX idx_classifications_type ON classifications (type);
CREATE INDEX idx_classifications_classification_id ON classifications (classification_id);

-- Enable Row Level Security (allow all access via anon key for now)
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access" ON classifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_classifications_updated_at
  BEFORE UPDATE ON classifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
