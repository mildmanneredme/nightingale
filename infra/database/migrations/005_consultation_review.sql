-- PRD-013: Doctor Review Dashboard
-- Extends consultations with review-related columns and new statuses.

-- Add review-related columns to consultations
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES doctors(id),
  ADD COLUMN IF NOT EXISTS soap_note JSONB,
  ADD COLUMN IF NOT EXISTS differential_diagnoses JSONB,
  ADD COLUMN IF NOT EXISTS ai_draft TEXT,
  ADD COLUMN IF NOT EXISTS doctor_draft TEXT,
  ADD COLUMN IF NOT EXISTS amendment_diff TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS rejection_message TEXT,
  ADD COLUMN IF NOT EXISTS priority_flags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES doctors(id);

-- Extend status check constraint (drop and recreate)
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check
  CHECK (status IN (
    'pending','active','transcript_ready','queued_for_review',
    'emergency_escalated','cannot_assess',
    'approved','amended','rejected'
  ));

CREATE INDEX IF NOT EXISTS idx_consultations_assigned_doctor ON consultations(assigned_doctor_id);
