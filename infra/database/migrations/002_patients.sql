-- PRD-006: Patient Registration & Profile
-- All patient PII stored in ap-southeast-2 (enforced at infrastructure level).

-- Core patient record — linked to Cognito via cognito_sub
CREATE TABLE IF NOT EXISTS patients (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub             TEXT        NOT NULL UNIQUE,  -- Cognito user ID (immutable)

  -- Personal information
  full_name               TEXT,
  date_of_birth           DATE,
  biological_sex          TEXT        CHECK (biological_sex IN ('male', 'female', 'intersex', 'prefer_not_to_say')),

  -- Contact
  email                   TEXT        NOT NULL,
  phone                   TEXT,
  address                 TEXT,

  -- Australian healthcare identifiers (free-text only at Phase 1; no HI Service lookup)
  medicare_number         TEXT,
  ihi_number              TEXT,

  -- Emergency contact
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_rel   TEXT,

  -- Consent & compliance
  privacy_policy_accepted_at  TIMESTAMPTZ,
  privacy_policy_version      TEXT,

  -- Paediatric
  is_paediatric               BOOLEAN     NOT NULL DEFAULT FALSE,
  guardian_name               TEXT,
  guardian_email              TEXT,
  guardian_relationship       TEXT,

  -- Lifecycle
  deletion_requested_at       TIMESTAMPTZ,     -- soft-delete; records retained 7 years
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT paediatric_requires_guardian CHECK (
    NOT is_paediatric OR (
      guardian_name IS NOT NULL AND
      guardian_email IS NOT NULL AND
      guardian_relationship IS NOT NULL
    )
  )
);

GRANT INSERT, SELECT, UPDATE ON patients TO app_role;
CREATE INDEX IF NOT EXISTS idx_patients_cognito_sub ON patients (cognito_sub);

-- Allergies
CREATE TABLE IF NOT EXISTS patient_allergies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE, DELETE ON patient_allergies TO app_role;
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies (patient_id);

-- Current medications
CREATE TABLE IF NOT EXISTS patient_medications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  dose        TEXT,
  frequency   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE, DELETE ON patient_medications TO app_role;
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications (patient_id);

-- Known conditions / diagnoses
CREATE TABLE IF NOT EXISTS patient_conditions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE, DELETE ON patient_conditions TO app_role;
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions (patient_id);

-- Auto-update updated_at on patients
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_updated_at ON patients;
CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
