-- PRD-023 S-09: Audit Log Retention Enforcement at Database Level
--
-- Australian Privacy Act (1988) plus AHPRA medical-records guidance require that
-- clinical audit data be retained for at least 7 years and not be silently
-- mutated. Migration 001_audit_log.sql restricted the application role to
-- INSERT + SELECT via GRANTs. That alone is brittle: any future migration that
-- accidentally re-grants UPDATE/DELETE would silently re-open the hole.
--
-- This migration adds defence-in-depth at the row level:
--   * F-101 — DELETE on audit_log is blocked for any non-superuser role
--   * F-102 — UPDATE on audit_log is blocked for any non-superuser role
--   * F-103 — Rationale documented inline (this comment block)
--
-- Bypass: an RDS superuser / DBA performing a court-ordered legal hold or
-- approved data subject access request can issue `SET LOCAL ROLE` to a
-- superuser and the trigger will permit the operation. This matches the
-- exception model documented in docs/shipped/SEC-001 and the operational
-- playbook in docs/shipped/OPS-001.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- RDS superusers (and the local Postgres superuser used in dev / test
  -- bootstrap) retain full access so legal-hold and disaster-recovery
  -- workflows are not impeded.
  IF current_setting('is_superuser') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION
    'audit_log is append-only — % blocked for role % (PRD-023 S-09)',
    TG_OP, current_user
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

COMMENT ON FUNCTION prevent_audit_log_mutation() IS
  'PRD-023 S-09: enforces 7-year Privacy Act retention by blocking UPDATE and DELETE on audit_log for non-superuser roles. Superusers retain access for legal holds.';
