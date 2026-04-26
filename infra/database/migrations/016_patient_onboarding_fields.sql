-- PRD-023: Patient Onboarding & Clinical Baseline
--
-- Adds the columns required by the onboarding wizard:
--   - first_name / last_name / preferred_name
--   - gp_name / gp_clinic
--   - onboarding_completed_at / onboarding_skipped_steps
--
-- Existing schema notes (002_patients.sql):
--   - full_name already exists; first_name + last_name supplement it (full_name
--     stays as the canonical display field, derived from first+last by the API
--     when both are provided).
--   - date_of_birth, biological_sex, phone, address, medicare_number,
--     ihi_number, emergency_contact_*, guardian_* already exist.
--   - Allergies / medications / known conditions live in their own normalised
--     tables (patient_allergies, patient_medications, patient_conditions).
-- This migration only adds the genuinely-missing columns.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS first_name                  TEXT,
  ADD COLUMN IF NOT EXISTS last_name                   TEXT,
  ADD COLUMN IF NOT EXISTS preferred_name              TEXT,
  ADD COLUMN IF NOT EXISTS gp_name                     TEXT,
  ADD COLUMN IF NOT EXISTS gp_clinic                   TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_steps    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  -- Explicit "I have none of these" markers so completeness can distinguish
  -- "patient hasn't answered yet" from "patient confirmed nothing applies".
  ADD COLUMN IF NOT EXISTS allergies_none_declared     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS medications_none_declared   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS conditions_none_declared    BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill first_name / last_name from full_name for existing patients (best-effort
-- split on the last space; multi-word first names will be grouped, multi-word
-- surnames will lose all but the last token — acceptable for a one-off backfill
-- because patients can correct via the wizard banner).
UPDATE patients
   SET first_name = TRIM(SPLIT_PART(full_name, ' ', 1)),
       last_name  = NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name))), '')
 WHERE full_name IS NOT NULL
   AND first_name IS NULL
   AND last_name IS NULL;
