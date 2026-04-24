-- PRD-018: Script Renewal Workflow
--
-- Tracks repeat prescription renewal requests from patients.
-- eScript issuance is out of scope for Phase 1 — doctor approval is recorded here;
-- the doctor handles actual prescription issuance via their own prescribing system.

CREATE TABLE IF NOT EXISTS renewal_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID        NOT NULL REFERENCES patients(id),
  -- Source consultation that originally recommended this medication
  source_consultation_id UUID       REFERENCES consultations(id),

  -- Medication details (from patient's prior consultation)
  medication_name       TEXT        NOT NULL,
  dosage                TEXT,

  -- Patient attestation
  no_adverse_effects    BOOLEAN     NOT NULL DEFAULT TRUE,
  condition_unchanged   BOOLEAN     NOT NULL DEFAULT TRUE,
  patient_notes         TEXT,

  -- Reminder opt-in (7-day proactive renewal reminders)
  reminders_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,

  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'declined')),

  -- Doctor review
  reviewed_by           UUID        REFERENCES doctors(id),
  reviewed_at           TIMESTAMPTZ,
  review_note           TEXT,         -- doctor's instructions or decline reason

  -- Expiry tracking
  -- Set by doctor when approving; default 28 days from approval date
  valid_until           DATE,

  -- Expiry alerts (managed by scheduled job in production)
  alert_48h_sent_at     TIMESTAMPTZ,  -- set when 48h doctor queue alert fired
  reminder_7d_sent_at   TIMESTAMPTZ,  -- set when 7-day patient reminder sent

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE ON renewal_requests TO app_role;

CREATE INDEX IF NOT EXISTS idx_renewals_patient       ON renewal_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status        ON renewal_requests(status);
CREATE INDEX IF NOT EXISTS idx_renewals_valid_until   ON renewal_requests(valid_until)
  WHERE valid_until IS NOT NULL AND status = 'approved';

-- Auto-update updated_at
DROP TRIGGER IF EXISTS renewal_requests_updated_at ON renewal_requests;
CREATE TRIGGER renewal_requests_updated_at
  BEFORE UPDATE ON renewal_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
