import { pool } from "../db";

export interface PatientRow {
  id: string;
  cognito_sub: string;
  email: string;
  fullName: string | null;
  dateOfBirth: string | null;
  biologicalSex: string | null;
  phone: string | null;
  address: string | null;
  medicareNumber: string | null;
  ihiNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRel: string | null;
  isPaediatric: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianRelationship: string | null;
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
  dateOfBirth: string | null;
  biologicalSex: string | null;
  phone: string | null;
  address: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianRelationship: string | null;
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
       id, cognito_sub, email, full_name AS "fullName",
       date_of_birth AS "dateOfBirth", biological_sex AS "biologicalSex",
       phone, address, medicare_number AS "medicareNumber",
       ihi_number AS "ihiNumber",
       emergency_contact_name AS "emergencyContactName",
       emergency_contact_phone AS "emergencyContactPhone",
       emergency_contact_rel AS "emergencyContactRel",
       is_paediatric AS "isPaediatric",
       guardian_name AS "guardianName",
       guardian_email AS "guardianEmail",
       guardian_relationship AS "guardianRelationship",
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
    dateOfBirth?: string | null;
    biologicalSex?: string | null;
    phone?: string | null;
    address?: string | null;
    medicareNumber?: string | null;
    ihiNumber?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRel?: string | null;
    guardianName?: string | null;
    guardianEmail?: string | null;
    guardianRelationship?: string | null;
  }
): Promise<UpdatedPatientRow | undefined> {
  const { rows } = await pool.query<UpdatedPatientRow>(
    `UPDATE patients SET
       full_name               = COALESCE($2, full_name),
       date_of_birth           = COALESCE($3, date_of_birth),
       biological_sex          = COALESCE($4, biological_sex),
       phone                   = COALESCE($5, phone),
       address                 = COALESCE($6, address),
       medicare_number         = COALESCE($7, medicare_number),
       ihi_number              = COALESCE($8, ihi_number),
       emergency_contact_name  = COALESCE($9, emergency_contact_name),
       emergency_contact_phone = COALESCE($10, emergency_contact_phone),
       emergency_contact_rel   = COALESCE($11, emergency_contact_rel),
       guardian_name           = COALESCE($12, guardian_name),
       guardian_email          = COALESCE($13, guardian_email),
       guardian_relationship   = COALESCE($14, guardian_relationship)
     WHERE cognito_sub = $1 AND deletion_requested_at IS NULL
     RETURNING
       id, email,
       full_name AS "fullName",
       to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
       biological_sex AS "biologicalSex",
       phone, address,
       guardian_name AS "guardianName",
       guardian_email AS "guardianEmail",
       guardian_relationship AS "guardianRelationship"`,
    [
      sub,
      fields.fullName ?? null,
      fields.dateOfBirth ?? null,
      fields.biologicalSex ?? null,
      fields.phone ?? null,
      fields.address ?? null,
      fields.medicareNumber ?? null,
      fields.ihiNumber ?? null,
      fields.emergencyContactName ?? null,
      fields.emergencyContactPhone ?? null,
      fields.emergencyContactRel ?? null,
      fields.guardianName ?? null,
      fields.guardianEmail ?? null,
      fields.guardianRelationship ?? null,
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
