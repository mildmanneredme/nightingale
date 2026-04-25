import { pool } from "../db";

export interface NotificationRow {
  id: string;
  consultation_id: string;
  patient_id: string;
}

export async function findNotificationBySendgridMessageId(messageId: string): Promise<NotificationRow | undefined> {
  const { rows } = await pool.query<NotificationRow>(
    `SELECT id, consultation_id, patient_id
     FROM notifications
     WHERE sendgrid_message_id = $1`,
    [messageId]
  );
  return rows[0];
}

export async function markNotificationDelivered(notificationId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET status = 'delivered', delivered_at = NOW() WHERE id = $1`,
    [notificationId]
  );
}

export async function insertNotificationDeliveredAuditLog(
  patientId: string,
  consultationId: string,
  notificationId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('notification.delivered', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ notification_id: notificationId })]
  );
}

export async function markNotificationBounced(notificationId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET status = 'bounced' WHERE id = $1`,
    [notificationId]
  );
}

export async function insertNotificationFailedAuditLog(
  patientId: string,
  consultationId: string,
  notificationId: string,
  event: string,
  reason: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('notification.delivery_failed', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ notification_id: notificationId, event, reason })]
  );
}

export async function markNotificationFailed(notificationId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET status = 'failed' WHERE id = $1`,
    [notificationId]
  );
}

export async function insertSpamReportAuditLog(
  patientId: string,
  consultationId: string,
  notificationId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
     VALUES ('notification.delivery_failed', $1, 'patient', $2, $3)`,
    [patientId, consultationId, JSON.stringify({ notification_id: notificationId, event: "spamreport" })]
  );
}
