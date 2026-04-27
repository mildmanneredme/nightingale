-- LLM usage and cost tracking.
--
-- Two tables:
--   llm_pricing  — current price list per (provider, model). Editable by DBA.
--   llm_usage    — append-only ledger of every LLM call. One row per Claude
--                  call, one row per Gemini chat turn, one row per completed
--                  Gemini Live session (aggregated).
--
-- Cost is stored in micro-USD (BIGINT) to avoid float drift. 1_000_000 = $1.00.
-- All token columns default to 0 so partial provider responses are safe.

CREATE TABLE IF NOT EXISTS llm_pricing (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                 TEXT         NOT NULL CHECK (provider IN ('anthropic','bedrock','google')),
  model_id                 TEXT         NOT NULL,
  input_per_mtok_usd       NUMERIC(12,6) NOT NULL,
  output_per_mtok_usd      NUMERIC(12,6) NOT NULL,
  cache_read_per_mtok_usd  NUMERIC(12,6),
  cache_write_per_mtok_usd NUMERIC(12,6),
  effective_from           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes                    TEXT,
  UNIQUE (provider, model_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_llm_pricing_lookup
  ON llm_pricing (provider, model_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS llm_usage (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     UUID,
  operation           TEXT         NOT NULL,
  provider            TEXT         NOT NULL,
  model_id            TEXT         NOT NULL,
  input_tokens        INTEGER      NOT NULL DEFAULT 0,
  output_tokens       INTEGER      NOT NULL DEFAULT 0,
  cache_read_tokens   INTEGER      NOT NULL DEFAULT 0,
  cache_write_tokens  INTEGER      NOT NULL DEFAULT 0,
  cost_usd_micros     BIGINT       NOT NULL DEFAULT 0,
  is_estimated        BOOLEAN      NOT NULL DEFAULT FALSE,
  correlation_id      TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_consultation_id ON llm_usage (consultation_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at      ON llm_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model_id        ON llm_usage (model_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_operation       ON llm_usage (operation);

GRANT INSERT, SELECT ON llm_usage   TO app_role;
GRANT SELECT          ON llm_pricing TO app_role;

-- Seed: list prices as published by Anthropic and Google as of 2026-04.
-- DBA must update these when providers change pricing. Cost rows already
-- written use the rate that was effective at insert time.
INSERT INTO llm_pricing
  (provider,    model_id,                                      input_per_mtok_usd, output_per_mtok_usd, cache_read_per_mtok_usd, cache_write_per_mtok_usd, notes)
VALUES
  ('anthropic', 'claude-sonnet-4-6',                            3.000000, 15.000000, 0.300000, 3.750000, 'Claude Sonnet 4.6 list (Anthropic direct API)'),
  ('bedrock',   'anthropic.claude-sonnet-4-6-20251001-v1:0',    3.000000, 15.000000, 0.300000, 3.750000, 'Claude Sonnet 4.6 on AWS Bedrock — list parity'),
  ('google',    'gemini-3.1-flash-live-preview',                0.500000,  2.000000, NULL,     NULL,     'Gemini 3.1 Flash Live preview — verify against console'),
  ('google',    'gemini-2.5-flash',                             0.300000,  2.500000, NULL,     NULL,     'Gemini 2.5 Flash list')
ON CONFLICT DO NOTHING;
