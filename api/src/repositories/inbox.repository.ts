import { pool } from "../db";

export interface PatientIdRow {
  id: string;
}

export interface InboxCountRow {
  count: string;
}

export interface InboxItemRow {
  notification_id: string;
  notification_type: string;
  delivery_status: string;
  sent_at: Date;
  read_at: Date | null;
  consultation_id: string;
  consultation_status: string;
  reviewed_at: Date | null;
  presenting_complaint: string;
  response_preview: string;
  doctor_full_name: string | null;
}

export interface MarkReadRow {
  id: string;
  read_at: Date;
}

export async function findPatientIdBySub(sub: string): Promise<PatientIdRow | undefined> {
  const { rows } = await pool.query<PatientIdRow>(
    `SELECT id FROM patients WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function countInboxItems(patientId: string): Promise<number> {
  const { rows } = await pool.query<InboxCountRow>(
    `SELECT COUNT(*) FROM notifications n
     JOIN consultations c ON c.id = n.consultation_id
     WHERE n.patient_id = $1
       AND c.status IN ('approved', 'amended', 'rejected')`,
    [patientId]
  );
  return parseInt(rows[0].count, 10);
}

export async function listInboxItems(
  patientId: string,
  limit: number,
  offset: number
): Promise<InboxItemRow[]> {
  const { rows } = await pool.query<InboxItemRow>(
    `SELECT
       n.id                AS notification_id,
       n.notification_type,
       n.status            AS delivery_status,
       n.sent_at,
       n.read_at,
       c.id                AS consultation_id,
       c.status            AS consultation_status,
       c.reviewed_at,
       c.presenting_complaint,
       COALESCE(c.doctor_draft, c.ai_draft, '') AS response_preview,
       d.full_name         AS doctor_full_name
     FROM notifications n
     JOIN consultations c ON c.id = n.consultation_id
     LEFT JOIN doctors d  ON d.id = c.reviewed_by
     WHERE n.patient_id = $1
       AND c.status IN ('approved', 'amended', 'rejected')
     ORDER BY n.sent_at DESC
     LIMIT $2 OFFSET $3`,
    [patientId, limit, offset]
  );
  return rows;
}

export async function markNotificationRead(
  notificationId: string,
  patientId: string
): Promise<MarkReadRow | undefined> {
  const { rows } = await pool.query<MarkReadRow>(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE id = $1 AND patient_id = $2 AND read_at IS NULL
     RETURNING id, read_at`,
    [notificationId, patientId]
  );
  return rows[0];
}
