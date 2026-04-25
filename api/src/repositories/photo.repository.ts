import { pool } from "../db";

export interface PatientIdRow {
  id: string;
}

export interface ConsultationStatusRow {
  id: string;
  status: string;
}

export interface PhotoCountRow {
  count: string;
}

export interface PhotoRow {
  id: string;
  consultationId: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  qualityPassed: boolean;
  qualityIssues: unknown;
  createdAt: Date;
}

export interface PhotoListRow extends PhotoRow {
  qualityOverridden: boolean;
}

export interface PhotoS3Row {
  id: string;
  s3_key: string;
}

export interface DoctorIdRow {
  id: string;
}

export async function findPatientIdBySub(sub: string): Promise<string | null> {
  const { rows } = await pool.query<PatientIdRow>(
    `SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0]?.id ?? null;
}

export async function findConsultationByIdAndPatient(
  consultationId: string,
  patientId: string
): Promise<ConsultationStatusRow | null> {
  const { rows } = await pool.query<ConsultationStatusRow>(
    `SELECT id, status FROM consultations WHERE id = $1 AND patient_id = $2`,
    [consultationId, patientId]
  );
  return rows[0] ?? null;
}

export async function countPhotosByConsultation(consultationId: string): Promise<number> {
  const { rows } = await pool.query<PhotoCountRow>(
    `SELECT COUNT(*) AS count FROM consultation_photos WHERE consultation_id = $1`,
    [consultationId]
  );
  return parseInt(rows[0].count, 10);
}

export async function insertPhoto(
  consultationId: string,
  s3Key: string,
  mimeType: string,
  sizeBytes: number,
  widthPx: number,
  heightPx: number,
  qualityPassed: boolean,
  qualityIssues: unknown
): Promise<PhotoRow> {
  const { rows } = await pool.query<PhotoRow>(
    `INSERT INTO consultation_photos
       (consultation_id, s3_key, mime_type, size_bytes, width_px, height_px,
        quality_passed, quality_issues, quality_overridden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING
       id,
       consultation_id AS "consultationId",
       mime_type AS "mimeType",
       size_bytes AS "sizeBytes",
       width_px AS "widthPx",
       height_px AS "heightPx",
       quality_passed AS "qualityPassed",
       quality_issues AS "qualityIssues",
       created_at AS "createdAt"`,
    [consultationId, s3Key, mimeType, sizeBytes, widthPx, heightPx, qualityPassed, JSON.stringify(qualityIssues), false]
  );
  return rows[0];
}

export async function insertPhotoAuditLog(
  patientId: string,
  consultationId: string,
  photoId: string,
  qualityPassed: boolean,
  qualityIssues: unknown
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('photo.uploaded', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ photoId, qualityPassed, qualityIssues })]
  );
}

export async function listPhotosByConsultation(consultationId: string): Promise<PhotoListRow[]> {
  const { rows } = await pool.query<PhotoListRow>(
    `SELECT
       id,
       consultation_id AS "consultationId",
       mime_type AS "mimeType",
       size_bytes AS "sizeBytes",
       width_px AS "widthPx",
       height_px AS "heightPx",
       quality_passed AS "qualityPassed",
       quality_issues AS "qualityIssues",
       quality_overridden AS "qualityOverridden",
       created_at AS "createdAt"
     FROM consultation_photos
     WHERE consultation_id = $1
     ORDER BY created_at ASC`,
    [consultationId]
  );
  return rows;
}

export async function findDoctorIdBySub(sub: string): Promise<DoctorIdRow | undefined> {
  const { rows } = await pool.query<DoctorIdRow>(
    `SELECT id FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function findPhotoWithConsultationAccess(
  photoId: string,
  consultationId: string,
  isAdmin: boolean,
  doctorId: string | null
): Promise<PhotoS3Row | undefined> {
  const { rows } = await pool.query<PhotoS3Row>(
    `SELECT cp.id, cp.s3_key
     FROM consultation_photos cp
     JOIN consultations c ON c.id = cp.consultation_id
     WHERE cp.id = $1
       AND cp.consultation_id = $2
       AND ($3::boolean OR c.assigned_doctor_id = $4)`,
    [photoId, consultationId, isAdmin, doctorId]
  );
  return rows[0];
}

export async function insertPhotoAccessAuditLog(
  actorId: string,
  actorRole: string,
  consultationId: string,
  photoId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('photo.access_url_generated', $1, $2, $3, $4)`,
    [actorId, actorRole, consultationId, JSON.stringify({ photoId, expirySeconds: 900 })]
  );
}
