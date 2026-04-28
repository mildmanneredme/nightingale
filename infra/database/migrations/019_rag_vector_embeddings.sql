-- PRD-032: Semantic RAG Pipeline — vector embedding support
--
-- Activates pgvector and migrates knowledge_chunks.embedding from TEXT
-- (provisioned in 006_rag.sql as a placeholder) to vector(1024) for
-- Bedrock Titan Embed Text V2 output dimensions.
--
-- PREREQUISITE: pgvector must be installed on the RDS instance.
-- Run as superuser before this migration:
--   CREATE EXTENSION IF NOT EXISTS vector;
-- The statement below is a no-op if the extension is already enabled.

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the placeholder TEXT column and replace with proper vector type.
-- The column was never populated (always NULL) so no data is lost.
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1024);

-- HNSW index for fast approximate cosine similarity search.
-- HNSW is preferred over IVFFlat: no minimum row count required,
-- better recall at low-to-medium dataset sizes (~5k–50k chunks).
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Partial index covering only rows with embeddings populated,
-- so the index does not waste space on NULL rows during backfill.
-- (The HNSW index above already skips NULLs; this is for query planner clarity.)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_notnull_idx
  ON knowledge_chunks (id)
  WHERE embedding IS NOT NULL;
