-- PRD-015: Post-Consultation Follow-Up

-- Add follow-up tracking columns to consultations.
-- followup_token: unique per-consultation UUID used in tracking URLs (no auth required)
-- followup_send_at: computed at approval time (reviewed_at + 36 hours)
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS followup_token      UUID        DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS followup_send_at    TIMESTAMPTZ,  -- when to send (reviewed_at + 36h)
  ADD COLUMN IF NOT EXISTS followup_sent_at    TIMESTAMPTZ,  -- when it was actually sent
  ADD COLUMN IF NOT EXISTS followup_response   TEXT        CHECK (
                              followup_response IN ('better', 'same', 'worse', 'no_response')
                            ),
  ADD COLUMN IF NOT EXISTS followup_responded_at TIMESTAMPTZ;

-- Extend status check constraint with follow-up outcome statuses
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check
  CHECK (status IN (
    'pending','active','transcript_ready','queued_for_review',
    'emergency_escalated','cannot_assess',
    'approved','amended','rejected',
    'resolved',          -- follow-up: patient reported "feeling better"
    'unchanged',         -- follow-up: patient reported "about the same"
    'followup_concern'   -- follow-up: patient reported "feeling worse" — re-opened for doctor
  ));

-- Index for scheduler: find consultations ready for follow-up email
CREATE INDEX IF NOT EXISTS idx_consultations_followup_send
  ON consultations(followup_send_at)
  WHERE followup_sent_at IS NULL AND followup_send_at IS NOT NULL;

-- Index for tracking URL lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_followup_token
  ON consultations(followup_token)
  WHERE followup_token IS NOT NULL;
