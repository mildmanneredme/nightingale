-- Migration 012: Add idempotency_key to consultations
-- SEC-003: Prevents double-submit creating duplicate consultation records.
-- The unique constraint is on (patient_id, idempotency_key) to allow
-- different patients to happen to use the same key value.

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS consultations_patient_idempotency_key_idx
  ON consultations (patient_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
