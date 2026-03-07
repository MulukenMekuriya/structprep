-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to sp_document_chunks (1024 dimensions for text-embedding-3-small)
ALTER TABLE sp_document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Add tsvector column for full-text search
ALTER TABLE sp_document_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS sp_idx_chunks_embedding
  ON sp_document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS sp_idx_chunks_tsv
  ON sp_document_chunks
  USING gin (tsv);

-- ============================================================
-- RPC Function: Vector similarity search
-- ============================================================
CREATE OR REPLACE FUNCTION sp_match_document_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_type text,
  section_ref text,
  chapter text,
  page_number int,
  token_count int,
  metadata jsonb,
  similarity float,
  doc_title text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_type::text,
    dc.section_ref,
    dc.chapter,
    dc.page_number,
    dc.token_count,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    rm.title AS doc_title
  FROM sp_document_chunks dc
  JOIN sp_reference_materials rm ON rm.id = dc.document_id
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- RPC Function: Full-text keyword search
-- ============================================================
CREATE OR REPLACE FUNCTION sp_keyword_search_chunks(
  search_query text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_type text,
  section_ref text,
  chapter text,
  page_number int,
  token_count int,
  metadata jsonb,
  rank float,
  doc_title text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_type::text,
    dc.section_ref,
    dc.chapter,
    dc.page_number,
    dc.token_count,
    dc.metadata,
    ts_rank(dc.tsv, websearch_to_tsquery('english', search_query)) AS rank,
    rm.title AS doc_title
  FROM sp_document_chunks dc
  JOIN sp_reference_materials rm ON rm.id = dc.document_id
  WHERE dc.tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
