-- Migration: Create ERN RAG tables for semantic + full-text search
-- Enables pgvector for embedding storage and similarity search

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. ERN chunks table (tasks, guidelines, box documents)
CREATE TABLE IF NOT EXISTS ern_chunks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- 'task', 'guideline', 'annex', 'document'
  sector TEXT,
  sector_id TEXT,
  phase TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  classification TEXT[],           -- e.g. {'red','orange','yellow'}
  office_type TEXT,
  priority TEXT,
  source TEXT,                     -- 'search-chunks' or 'box-chunks'
  embedding extensions.vector(1536),  -- text-embedding-3-small dimension
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ERN resources table (templates, tools with URLs)
CREATE TABLE IF NOT EXISTS ern_resources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  sector TEXT,
  task TEXT,
  embedding extensions.vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. HNSW indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_ern_chunks_embedding
  ON ern_chunks USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ern_resources_embedding
  ON ern_resources USING hnsw (embedding extensions.vector_cosine_ops);

-- 5. GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_ern_chunks_fts
  ON ern_chunks USING gin (fts);

-- 6. Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_ern_chunks_type ON ern_chunks (type);
CREATE INDEX IF NOT EXISTS idx_ern_chunks_sector ON ern_chunks (sector);
CREATE INDEX IF NOT EXISTS idx_ern_chunks_phase ON ern_chunks (phase);

-- 7. Hybrid search function: blends vector similarity with full-text ranking
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding extensions.vector(1536),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 10,
  filter_type TEXT DEFAULT NULL,
  filter_sector TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  type TEXT,
  sector TEXT,
  sector_id TEXT,
  phase TEXT,
  title TEXT,
  content TEXT,
  priority TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.sector,
    c.sector_id,
    c.phase,
    c.title,
    c.content,
    c.priority,
    c.source,
    (
      0.7 * (1 - (c.embedding <=> query_embedding)) +
      0.3 * COALESCE(ts_rank(c.fts, plainto_tsquery('english', query_text)), 0)
    )::FLOAT AS similarity
  FROM ern_chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (filter_type IS NULL OR c.type = filter_type)
    AND (filter_sector IS NULL OR c.sector = filter_sector)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 8. Resource search function
CREATE OR REPLACE FUNCTION search_resources(
  query_embedding extensions.vector(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id INT,
  name TEXT,
  url TEXT,
  sector TEXT,
  task TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.url,
    r.sector,
    r.task,
    (1 - (r.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ern_resources r
  WHERE r.embedding IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 9. RLS policies: allow public read access via anon key
ALTER TABLE ern_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ern_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to ern_chunks"
  ON ern_chunks FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to ern_resources"
  ON ern_resources FOR SELECT
  USING (true);
