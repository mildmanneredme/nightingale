import { pool } from "../db";
import { logger } from "../logger";

export interface ConsultationRow {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint: string | null;
  createdAt: Date;
}

export interface ConsultationDetailRow {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint: string | null;
  transcript: unknown;
  redFlags: unknown;
  assessment: string | null;
  doctorDraft: string | null;
  rejectionMessage: string | null;
  createdAt: Date;
  sessionStartedAt: Date | null;
  sessionEndedAt: Date | null;
}

export interface ConsultationListRow {
  id: string;
  status: string;
  consultationType: string;
  presentingComplaint: string | null;
  createdAt: Date;
  sessionStartedAt: Date | null;
  sessionEndedAt: Date | null;
}

export interface ConsultationEndRow {
  id: string;
  status: string;
  consultationType: string;
  transcript: unknown;
  sessionEndedAt: Date;
}

export interface ConsultationChatRow {
  id: string;
  status: string;
  consultation_type: string;
  transcript: unknown;
  presenting_complaint: string | null;
}

export interface ConsultationPdfRow {
  id: string;
  presenting_complaint: string;
  status: string;
  reviewed_at: Date | null;
  doctor_draft: string | null;
  ai_draft: string | null;
  doctor_first_name: string;
  doctor_last_name: string;
  ahpra_number: string;
  patient_id: string;
  patient_cognito_sub: string;
}

export async function findPatientIdBySub(sub: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0]?.id ?? null;
}

export async function findExistingConsultationByIdempotencyKey(
  patientId: string,
  idempotencyKey: string
): Promise<ConsultationRow | undefined> {
  const { rows } = await pool.query<ConsultationRow>(
    `SELECT id, status,
            consultation_type AS "consultationType",
            presenting_complaint AS "presentingComplaint",
            created_at AS "createdAt"
     FROM consultations
     WHERE patient_id = $1
       AND idempotency_key = $2
       AND created_at >= NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [patientId, idempotencyKey]
  );
  return rows[0];
}

export async function insertConsultation(
  patientId: string,
  consultationType: string,
  presentingComplaint: string | null,
  idempotencyKey: string | null
): Promise<ConsultationRow> {
  const { rows } = await pool.query<ConsultationRow>(
    `INSERT INTO consultations (patient_id, consultation_type, presenting_complaint, idempotency_key)
     VALUES ($1, $2, $3, $4)
     RETURNING
       id,
       status,
       consultation_type AS "consultationType",
       presenting_complaint AS "presentingComplaint",
       created_at AS "createdAt"`,
    [patientId, consultationType, presentingComplaint, idempotencyKey]
  );
  return rows[0];
}

export async function countConsultationsByPatient(patientId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM consultations WHERE patient_id = $1`,
    [patientId]
  );
  return parseInt(rows[0].count, 10);
}

export async function listConsultationsByPatient(
  patientId: string,
  limit: number,
  offset: number
): Promise<ConsultationListRow[]> {
  const { rows } = await pool.query<ConsultationListRow>(
    `SELECT
       id,
       status,
       consultation_type AS "consultationType",
       COALESCE(
         presenting_complaint,
         (SELECT elem->>'text'
          FROM   jsonb_array_elements(transcript) AS elem
          WHERE  elem->>'speaker' = 'patient'
          ORDER BY (elem->>'timestamp_ms')::bigint
          LIMIT  1)
       ) AS "presentingComplaint",
       created_at AS "createdAt",
       session_started_at AS "sessionStartedAt",
       session_ended_at AS "sessionEndedAt"
     FROM consultations
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [patientId, limit, offset]
  );
  return rows;
}

export async function findConsultationByIdAndPatient(
  id: string,
  patientId: string
): Promise<ConsultationDetailRow | undefined> {
  const { rows } = await pool.query<ConsultationDetailRow>(
    `SELECT
       id,
       status,
       consultation_type AS "consultationType",
       COALESCE(
         presenting_complaint,
         (SELECT elem->>'text'
          FROM   jsonb_array_elements(transcript) AS elem
          WHERE  elem->>'speaker' = 'patient'
          ORDER BY (elem->>'timestamp_ms')::bigint
          LIMIT  1)
       ) AS "presentingComplaint",
       transcript,
       red_flags AS "redFlags",
       ai_draft AS "assessment",
       doctor_draft AS "doctorDraft",
       rejection_message AS "rejectionMessage",
       created_at AS "createdAt",
       session_started_at AS "sessionStartedAt",
       session_ended_at AS "sessionEndedAt"
     FROM consultations
     WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return rows[0];
}

export async function endConsultation(
  id: string,
  patientId: string,
  transcript: unknown
): Promise<ConsultationEndRow | undefined> {
  const { rows } = await pool.query<ConsultationEndRow>(
    `UPDATE consultations
     SET
       status = 'transcript_ready',
       transcript = $1,
       session_ended_at = NOW(),
       updated_at = NOW()
     WHERE id = $2 AND patient_id = $3
     RETURNING
       id,
       status,
       consultation_type AS "consultationType",
       transcript,
       session_ended_at AS "sessionEndedAt"`,
    [JSON.stringify(transcript ?? []), id, patientId]
  );
  return rows[0];
}

export async function findConsultationForChat(
  id: string,
  patientId: string
): Promise<ConsultationChatRow | undefined> {
  const { rows } = await pool.query<ConsultationChatRow>(
    `SELECT id, status, consultation_type, transcript, presenting_complaint
     FROM consultations
     WHERE id = $1 AND patient_id = $2`,
    [id, patientId]
  );
  return rows[0];
}

export async function backfillPresentingComplaint(id: string, complaint: string): Promise<void> {
  await pool.query(
    `UPDATE consultations SET presenting_complaint = $1 WHERE id = $2 AND presenting_complaint IS NULL`,
    [complaint.slice(0, 500), id]
  );
}

export async function updateConsultationChat(
  id: string,
  status: string,
  transcript: unknown
): Promise<void> {
  await pool.query(
    `UPDATE consultations
     SET status = $1,
         transcript = $2,
         session_started_at = CASE WHEN session_started_at IS NULL THEN NOW() ELSE session_started_at END,
         session_ended_at = CASE WHEN $1 IN ('transcript_ready', 'emergency_escalated') THEN NOW() ELSE session_ended_at END,
         updated_at = NOW()
     WHERE id = $3`,
    [status, JSON.stringify(transcript), id]
  );
}

export async function setConsultationAiFailed(id: string): Promise<void> {
  await pool.query(
    `UPDATE consultations
     SET status = 'ai_failed', updated_at = NOW()
     WHERE id = $1 AND status = 'transcript_ready'`,
    [id]
  );
}

export async function findConsultationForPdf(id: string): Promise<ConsultationPdfRow | undefined> {
  const { rows } = await pool.query<ConsultationPdfRow>(
    `SELECT c.id, c.presenting_complaint, c.status, c.reviewed_at,
            c.doctor_draft, c.ai_draft,
            d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
            d.ahpra_number,
            p.id AS patient_id, p.cognito_sub AS patient_cognito_sub
     FROM consultations c
     JOIN doctors d  ON d.id = c.reviewed_by
     JOIN patients p ON p.id = c.patient_id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0];
}

export async function insertPdfAuditLog(
  patientId: string,
  consultationId: string,
  doctorId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('consultation.pdf_downloaded', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ doctor_id: doctorId })]
  ).catch((err) => logger.error({ err, consultationId }, "Failed to log PDF download"));
}

export async function findConsultationOwnership(
  consultationId: string,
  patientId: string
): Promise<{ id: string } | undefined> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM consultations WHERE id = $1 AND patient_id = $2`,
    [consultationId, patientId]
  );
  return rows[0];
}

export async function insertWsToken(
  token: string,
  consultationId: string,
  patientId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO ws_tokens (token, consultation_id, patient_id, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '2 minutes')`,
    [token, consultationId, patientId]
  );
}
