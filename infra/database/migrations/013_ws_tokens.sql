-- Migration 013: WebSocket session tokens
-- SEC-004: Single-use, short-lived tokens for WebSocket voice consultation streams.
-- Prevents the consultation UUID being used as a session credential.

CREATE TABLE IF NOT EXISTS ws_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        NOT NULL UNIQUE,
  consultation_id UUID        NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ws_tokens_token_idx ON ws_tokens (token);
CREATE INDEX IF NOT EXISTS ws_tokens_expires_at_idx ON ws_tokens (expires_at);
