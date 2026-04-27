-- PRD-025: Doctor Onboarding & Admin Verification
-- Extends the doctors table with application workflow fields.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS primary_state TEXT,
  ADD COLUMN IF NOT EXISTS hours_per_week TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_admin_sub TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_admin_sub TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS application_ip TEXT;

-- Backfill: any pre-existing doctors row was created by an admin and is
-- already trusted — treat as approved so the existing queue is unaffected.
UPDATE doctors
   SET status = 'approved',
       approved_at = created_at
 WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS doctors_ahpra_number_idx ON doctors (ahpra_number);
CREATE INDEX IF NOT EXISTS doctors_status_applied_at_idx ON doctors (status, applied_at);
