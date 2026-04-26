import { pool } from "../db";

export interface PatientRow {
  id: string;
  cognito_sub: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  dateOfBirth: string | null;
  biologicalSex: string | null;
  phone: string | null;
  address: string | null;
  medicareNumber: string | null;
  ihiNumber: string | null;
  gpName: string | null;
  gpClinic: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRel: string | null;
  isPaediatric: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianRelationship: string | null;
  allergiesNoneDeclared: boolean;
  medicationsNoneDeclared: boolean;
  conditionsNoneDeclared: boolean;
  onboardingCompletedAt: Date | null;
  onboardingSkippedSteps: unknown;
  privacyPolicyAcceptedAt: Date | null;
  createdAt: Date;
}

export interface PatientIdRow {
  id: string;
}

export interface AllergyRow {
  id: string;
  name: string;
  severity: string | null;
}

export interface MedicationRow {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
}

export interface ConditionRow {
  id: string;
  name: string;
}

export interface RegisteredPatientRow {
  id: string;
  email: string;
}

export interface UpdatedPatientRow {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  dateOfBirth: string | null;
  biologicalSex: string | null;
  phone: string | null;
  address: string | null;
  gpName: string | null;
  gpClinic: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianRelationship: string | null;
  allergiesNoneDeclared: boolean;
  medicationsNoneDeclared: boolean;
  conditionsNoneDeclared: boolean;
  onboardingCompletedAt: Date | null;
}

export async function insertPatient(
  sub: string,
  email: string,
  privacyPolicyVersion: string
): Promise<RegisteredPatientRow> {
  const { rows } = await pool.query<RegisteredPatientRow>(
    `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
     VALUES ($1, $2, NOW(), $3)
     RETURNING id, email`,
    [sub, email, privacyPolicyVersion]
  );
  return rows[0];
}

export async function findPatientBySub(sub: string): Promise<PatientRow | undefined> {
  const { rows } = await pool.query<PatientRow>(
    `SELECT
       id, cognito_sub, email,
       full_name      AS "fullName",
       first_name     AS "firstName",
       last_name      AS "lastName",
       preferred_name AS "preferredName",
       to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
       biological_sex AS "biologicalSex",
       phone, address,
       medicare_number AS "medicareNumber",
       ihi_number      AS "ihiNumber",
       gp_name         AS "gpName",
       gp_clinic       AS "gpClinic",
       emergency_contact_name  AS "emergencyContactName",
       emergency_contact_phone AS "emergencyContactPhone",
       emergency_contact_rel   AS "emergencyContactRel",
       is_paediatric           AS "isPaediatric",
       guardian_name           AS "guardianName",
       guardian_email          AS "guardianEmail",
       guardian_relationship   AS "guardianRelationship",
       allergies_none_declared    AS "allergiesNoneDeclared",
       medications_none_declared  AS "medicationsNoneDeclared",
       conditions_none_declared   AS "conditionsNoneDeclared",
       onboarding_completed_at    AS "onboardingCompletedAt",
       onboarding_skipped_steps   AS "onboardingSkippedSteps",
       privacy_policy_accepted_at AS "privacyPolicyAcceptedAt",
       created_at AS "createdAt"
     FROM patients
     WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0];
}

export async function findPatientIdBySub(sub: string): Promise<PatientIdRow | undefined> {
  const { rows } = await pool.query<PatientIdRow>(
    `SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0];
}

export async function updatePatient(
  sub: string,
  fields: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    preferredName?: string | null;
    dateOfBirth?: string | null;
    biologicalSex?: string | null;
    phone?: string | null;
    address?: string | null;
    medicareNumber?: string | null;
    ihiNumber?: string | null;
    gpName?: string | null;
    gpClinic?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRel?: string | null;
    guardianName?: string | null;
    guardianEmail?: string | null;
    guardianRelationship?: string | null;
    allergiesNoneDeclared?: boolean;
    medicationsNoneDeclared?: boolean;
    conditionsNoneDeclared?: boolean;
  }
): Promise<UpdatedPatientRow | undefined> {
  // Derive full_name from first+last when both are supplied so the existing
  // display path continues to render correctly without callers needing to
  // duplicate the concatenation.
  const derivedFullName =
    fields.fullName ??
    (fields.firstName && fields.lastName
      ? `${fields.firstName} ${fields.lastName}`
      : null);

  const { rows } = await pool.query<UpdatedPatientRow>(
    `UPDATE patients SET
       full_name                  = COALESCE($2, full_name),
       first_name                 = COALESCE($3, first_name),
       last_name                  = COALESCE($4, last_name),
       preferred_name             = COALESCE($5, preferred_name),
       date_of_birth              = COALESCE($6, date_of_birth),
       biological_sex             = COALESCE($7, biological_sex),
       phone                      = COALESCE($8, phone),
       address                    = COALESCE($9, address),
       medicare_number            = COALESCE($10, medicare_number),
       ihi_number                 = COALESCE($11, ihi_number),
       gp_name                    = COALESCE($12, gp_name),
       gp_clinic                  = COALESCE($13, gp_clinic),
       emergency_contact_name     = COALESCE($14, emergency_contact_name),
       emergency_contact_phone    = COALESCE($15, emergency_contact_phone),
       emergency_contact_rel      = COALESCE($16, emergency_contact_rel),
       guardian_name              = COALESCE($17, guardian_name),
       guardian_email             = COALESCE($18, guardian_email),
       guardian_relationship      = COALESCE($19, guardian_relationship),
       allergies_none_declared    = COALESCE($20, allergies_none_declared),
       medications_none_declared  = COALESCE($21, medications_none_declared),
       conditions_none_declared   = COALESCE($22, conditions_none_declared)
     WHERE cognito_sub = $1 AND deletion_requested_at IS NULL
     RETURNING
       id, email,
       full_name      AS "fullName",
       first_name     AS "firstName",
       last_name      AS "lastName",
       preferred_name AS "preferredName",
       to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
       biological_sex AS "biologicalSex",
       phone, address,
       gp_name        AS "gpName",
       gp_clinic      AS "gpClinic",
       guardian_name           AS "guardianName",
       guardian_email          AS "guardianEmail",
       guardian_relationship   AS "guardianRelationship",
       allergies_none_declared    AS "allergiesNoneDeclared",
       medications_none_declared  AS "medicationsNoneDeclared",
       conditions_none_declared   AS "conditionsNoneDeclared",
       onboarding_completed_at    AS "onboardingCompletedAt"`,
    [
      sub,
      derivedFullName,
      fields.firstName ?? null,
      fields.lastName ?? null,
      fields.preferredName ?? null,
      fields.dateOfBirth ?? null,
      fields.biologicalSex ?? null,
      fields.phone ?? null,
      fields.address ?? null,
      fields.medicareNumber ?? null,
      fields.ihiNumber ?? null,
      fields.gpName ?? null,
      fields.gpClinic ?? null,
      fields.emergencyContactName ?? null,
      fields.emergencyContactPhone ?? null,
      fields.emergencyContactRel ?? null,
      fields.guardianName ?? null,
      fields.guardianEmail ?? null,
      fields.guardianRelationship ?? null,
      fields.allergiesNoneDeclared ?? null,
      fields.medicationsNoneDeclared ?? null,
      fields.conditionsNoneDeclared ?? null,
    ]
  );
  return rows[0];
}

export async function softDeletePatient(sub: string): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE patients SET deletion_requested_at = NOW()
     WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rowCount ?? 0;
}

export async function findPatientAllergies(patientId: string): Promise<AllergyRow[]> {
  const { rows } = await pool.query<AllergyRow>(
    `SELECT id, name, severity FROM patient_allergies WHERE patient_id = $1 ORDER BY created_at`,
    [patientId]
  );
  return rows;
}

export async function findPatientMedications(patientId: string): Promise<MedicationRow[]> {
  const { rows } = await pool.query<MedicationRow>(
    `SELECT id, name, dose, frequency FROM patient_medications WHERE patient_id = $1 ORDER BY created_at`,
    [patientId]
  );
  return rows;
}

export async function findPatientConditions(patientId: string): Promise<ConditionRow[]> {
  const { rows } = await pool.query<ConditionRow>(
    `SELECT id, name FROM patient_conditions WHERE patient_id = $1 ORDER BY created_at`,
    [patientId]
  );
  return rows;
}

export async function insertAllergy(
  patientId: string,
  name: string,
  severity: string | null
): Promise<AllergyRow> {
  const { rows } = await pool.query<AllergyRow>(
    `INSERT INTO patient_allergies (patient_id, name, severity)
     VALUES ($1, $2, $3)
     RETURNING id, name, severity`,
    [patientId, name, severity]
  );
  return rows[0];
}

export async function deleteAllergy(id: string, patientId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM patient_allergies WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return rowCount ?? 0;
}

export async function insertMedication(
  patientId: string,
  name: string,
  dose: string | null,
  frequency: string | null
): Promise<MedicationRow> {
  const { rows } = await pool.query<MedicationRow>(
    `INSERT INTO patient_medications (patient_id, name, dose, frequency)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, dose, frequency`,
    [patientId, name, dose, frequency]
  );
  return rows[0];
}

export async function deleteMedication(id: string, patientId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM patient_medications WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return rowCount ?? 0;
}

export async function insertCondition(patientId: string, name: string): Promise<ConditionRow> {
  const { rows } = await pool.query<ConditionRow>(
    `INSERT INTO patient_conditions (patient_id, name)
     VALUES ($1, $2)
     RETURNING id, name`,
    [patientId, name]
  );
  return rows[0];
}

export async function deleteCondition(id: string, patientId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM patient_conditions WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// PRD-023: Onboarding wizard
// ---------------------------------------------------------------------------

export async function recordOnboardingStep(
  sub: string,
  step: number,
  skipped: boolean,
  skippedFields: string[]
): Promise<void> {
  // Append a record of the step to onboarding_skipped_steps. We always record,
  // skipped or not, so analytics can reconstruct the wizard funnel later.
  const entry = JSON.stringify({
    step,
    skipped,
    skippedFields,
    at: new Date().toISOString(),
  });
  await pool.query(
    `UPDATE patients
        SET onboarding_skipped_steps = onboarding_skipped_steps || $2::jsonb
      WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub, `[${entry}]`]
  );
}

export async function markOnboardingComplete(sub: string): Promise<void> {
  await pool.query(
    `UPDATE patients
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
      WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
}
