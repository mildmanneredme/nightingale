import { pool } from "../db";
import { createHash } from "crypto";

export interface FollowUpDueRow {
  id: string;
  followup_token: string;
  presenting_complaint: string;
  reviewed_at: Date;
  status: string;
  patient_email: string;
  patient_name: string;
}

export interface FollowUpSendCountRow {
  cnt: string;
}

export interface FollowUpConsultationRow {
  id: string;
  status: string;
  patient_id: string;
  assigned_doctor_id: string | null;
  followup_response: string | null;
  presenting_complaint: string;
}

export async function findFollowUpsDue(): Promise<FollowUpDueRow[]> {
  const { rows } = await pool.query<FollowUpDueRow>(
    `SELECT c.id, c.followup_token, c.presenting_complaint,
            c.reviewed_at, c.status,
            p.email AS patient_email, p.full_name AS patient_name
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.followup_send_at IS NOT NULL
       AND c.followup_send_at <= NOW()
       AND c.status IN ('approved', 'amended')
     FOR UPDATE SKIP LOCKED
     LIMIT 50`
  );
  return rows;
}

export async function countFollowUpEmailsSent(consultationId: string): Promise<number> {
  const { rows } = await pool.query<FollowUpSendCountRow>(
    `SELECT COUNT(*) AS cnt FROM audit_log
     WHERE event_type = 'FOLLOWUP_EMAIL_SENT' AND consultation_id = $1`,
    [consultationId]
  );
  return parseInt(rows[0].cnt, 10);
}

export async function markFollowUpSent(consultationId: string): Promise<void> {
  await pool.query(
    `UPDATE consultations SET followup_sent_at = NOW() WHERE id = $1`,
    [consultationId]
  );
}

export async function insertFollowUpSentAuditLog(
  consultationId: string,
  tokenHash: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('follow_up.sent', $1, 'patient', $2, $3)`,
    [consultationId, consultationId, JSON.stringify({ token_hash: tokenHash })]
  );
}

export async function insertFollowUpEmailSentAuditLog(
  consultationId: string,
  tokenHash: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('FOLLOWUP_EMAIL_SENT', $1, 'patient', $2, $3)`,
    [consultationId, consultationId, JSON.stringify({ consultationId, token_hash: tokenHash })]
  );
}

export async function findConsultationByFollowUpToken(token: string): Promise<FollowUpConsultationRow | undefined> {
  const { rows } = await pool.query<FollowUpConsultationRow>(
    `SELECT id, status, patient_id, assigned_doctor_id,
            followup_response, presenting_complaint
     FROM consultations
     WHERE followup_token = $1`,
    [token]
  );
  return rows[0];
}

export async function updateFollowUpResponse(
  consultationId: string,
  response: string,
  newStatus: string
): Promise<void> {
  await pool.query(
    `UPDATE consultations
     SET followup_response = $1,
         followup_responded_at = NOW(),
         status = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [response, newStatus, consultationId]
  );
}

export async function insertFollowUpResponseAuditLog(
  patientId: string,
  consultationId: string,
  response: string,
  newStatus: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('follow_up.response_received', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ response_option: response, new_status: newStatus })]
  );
}

export async function appendFollowUpConcernFlag(consultationId: string): Promise<void> {
  await pool.query(
    `UPDATE consultations
     SET priority_flags = array_append(
           COALESCE(priority_flags, '{}'),
           'FOLLOWUP_CONCERN'
         )
     WHERE id = $1`,
    [consultationId]
  );
}

export async function insertConsultationReopenedAuditLog(
  patientId: string,
  consultationId: string,
  doctorId: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('consultation.reopened_for_followup', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ doctor_id: doctorId })]
  );
}

export async function scheduleFollowUpQuery(consultationId: string): Promise<void> {
  await pool.query(
    `UPDATE consultations
     SET followup_send_at = reviewed_at + INTERVAL '36 hours'
     WHERE id = $1
       AND status IN ('approved', 'amended')
       AND followup_send_at IS NULL`,
    [consultationId]
  );

  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     SELECT 'follow_up.scheduled', patient_id, 'patient', $1,
            jsonb_build_object('send_at', (reviewed_at + INTERVAL '36 hours'))
     FROM consultations WHERE id = $1`,
    [consultationId]
  );
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
