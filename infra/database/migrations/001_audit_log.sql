-- PRD-005: Audit Log Schema
-- Run as the RDS master user (nightingale_admin).
-- The app_role is used by the application — INSERT + SELECT only, no UPDATE/DELETE.

-- Application role with restricted privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role;
  END IF;
END
$$;

-- Audit log table — PRD-005 F-001, F-002, F-004
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT        NOT NULL,
  actor_id        UUID        NOT NULL,
  actor_role      TEXT        NOT NULL CHECK (actor_role IN ('patient', 'doctor', 'admin', 'system')),
  ahpra_number    TEXT,
  consultation_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Doctors must always have an AHPRA number on record — PRD-005 F-004
  CONSTRAINT doctor_requires_ahpra CHECK (
    actor_role != 'doctor' OR ahpra_number IS NOT NULL
  )
);

-- Immutable: grant INSERT + SELECT to app_role; no UPDATE or DELETE — PRD-005 F-001
GRANT INSERT, SELECT ON audit_log TO app_role;

-- Indexes for admin query patterns — PRD-005 F-007
CREATE INDEX IF NOT EXISTS idx_audit_log_consultation_id ON audit_log (consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id        ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type      ON audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at      ON audit_log (created_at DESC);

-- Verify immutability (run manually to confirm after applying migration):
-- SET ROLE app_role;
-- UPDATE audit_log SET event_type = 'tampered' WHERE FALSE; -- should fail
-- DELETE FROM audit_log WHERE FALSE;                        -- should fail
