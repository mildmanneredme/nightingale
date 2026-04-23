-- PRD-011: Clinical Knowledge Base & RAG Pipeline
-- Requires pgvector extension (must be enabled by RDS admin before running)
-- CREATE EXTENSION IF NOT EXISTS vector; -- run manually as superuser

-- Knowledge chunks for RAG retrieval
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name   TEXT    NOT NULL,   -- e.g. 'RACGP Red Book 2024'
  source_url    TEXT,
  category      TEXT    NOT NULL,   -- 'therapeutic-guidelines','medications','regulatory','escalation','question-trees','terminology'
  condition     TEXT,               -- e.g. 'urti', 'uti', 'skin-rash', 'musculoskeletal', 'mental-health'
  chunk_text    TEXT    NOT NULL,
  embedding     TEXT,               -- stored as text until pgvector extension available; cast to vector(1536) when extension enabled
  metadata      JSONB   DEFAULT '{}',
  md_approved_at TIMESTAMPTZ,       -- Medical Director sign-off date
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category ON knowledge_chunks(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_condition ON knowledge_chunks(condition);
-- Vector index created separately after embeddings populated and pgvector enabled:
-- CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- SNOMED CT-AU/AMT reference table (relational, not vector-indexed)
CREATE TABLE IF NOT EXISTS snomed_terms (
  concept_id    TEXT    PRIMARY KEY,   -- SNOMED concept ID
  fsn           TEXT    NOT NULL,      -- Fully Specified Name
  preferred_term TEXT   NOT NULL,      -- Preferred term (AU extension)
  semantic_tag  TEXT,                  -- e.g. 'disorder', 'finding', 'substance'
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snomed_terms_preferred ON snomed_terms(preferred_term);
CREATE INDEX IF NOT EXISTS idx_snomed_preferred_lower ON snomed_terms(lower(preferred_term));

GRANT INSERT, SELECT, UPDATE ON knowledge_chunks TO app_role;
GRANT INSERT, SELECT, UPDATE ON snomed_terms TO app_role;
