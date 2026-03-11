-- 5A: Sync history log
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running, success, error
  inserted INT DEFAULT 0,
  updated INT DEFAULT 0,
  unchanged INT DEFAULT 0,
  errors INT DEFAULT 0,
  duration_ms INT,
  error_details JSONB,
  total_rows INT DEFAULT 0
);

-- Allow public SELECT for admin dashboard
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sync_log" ON sync_log FOR SELECT USING (true);
-- Only service role can INSERT/UPDATE
CREATE POLICY "Service write sync_log" ON sync_log FOR ALL USING (auth.role() = 'service_role');

-- 1E: Chat feedback table
CREATE TABLE IF NOT EXISTS chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  query TEXT,
  site TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chat_feedback" ON chat_feedback FOR SELECT USING (true);
CREATE POLICY "Public insert chat_feedback" ON chat_feedback FOR INSERT WITH CHECK (true);

-- Index for analytics
CREATE INDEX idx_chat_feedback_rating ON chat_feedback(rating, created_at);
CREATE INDEX idx_sync_log_started ON sync_log(started_at DESC);
