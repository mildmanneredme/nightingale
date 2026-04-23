-- PRD-008: AI Voice Consultation
-- Stores consultation lifecycle, transcript, and red flag events.

CREATE TABLE IF NOT EXISTS consultations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID        NOT NULL REFERENCES patients (id),

  status               TEXT        NOT NULL DEFAULT 'pending' CHECK (
                         status IN (
                           'pending',           -- created, not yet started
                           'active',            -- Gemini Live session open
                           'transcript_ready',  -- session ended, transcript stored
                           'queued_for_review', -- placed in doctor queue (PRD-012 output done)
                           'emergency_escalated', -- 000 instruction issued
                           'cannot_assess'      -- AI flagged as not assessable remotely
                         )
                       ),

  consultation_type    TEXT        NOT NULL CHECK (consultation_type IN ('voice', 'text')),
  presenting_complaint TEXT,

  -- Transcript: ordered array of {speaker, text, timestamp_ms, confidence?}
  -- Speaker values: 'ai' | 'patient'
  transcript           JSONB,

  -- Red flags detected during session: [{phrase, detected_at}]
  red_flags            JSONB,

  session_started_at   TIMESTAMPTZ,
  session_ended_at     TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE ON consultations TO app_role;

CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations (patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status     ON consultations (status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations (created_at DESC);

-- Auto-update updated_at (reuses the function created in 002_patients.sql)
DROP TRIGGER IF EXISTS consultations_updated_at ON consultations;
CREATE TRIGGER consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
