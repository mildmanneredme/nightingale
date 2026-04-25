// PRD-014: Patient Inbox
//
// Returns the authenticated patient's consultation notifications (results, rejections).
// Patients can mark items as read; they cannot reply.

import { Router, RequestHandler } from "express";
import { pool } from "../db";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// GET /api/v1/inbox
// Returns all completed consultations for the authenticated patient,
// joined with their notification record (read_at, status).
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    if (Array.isArray(req.query.limit) || Array.isArray(req.query.offset)) {
      res.status(400).json({ error: "limit and offset must be single values" });
      return;
    }

    const rawLimit = parseInt(req.query.limit as string);
    const rawOffset = parseInt(req.query.offset as string);

    if (!isNaN(rawLimit) && (rawLimit < 1 || rawLimit > 100)) {
      res.status(400).json({ error: "limit must be between 1 and 100" });
      return;
    }

    const limit = Math.min(!isNaN(rawLimit) ? rawLimit : 20, 100);
    const offset = Math.max(0, !isNaN(rawOffset) ? rawOffset : 0);

    const { rows: patientRows } = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!patientRows[0]) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const patientId = patientRows[0].id;

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM notifications n
         JOIN consultations c ON c.id = n.consultation_id
         WHERE n.patient_id = $1
           AND c.status IN ('approved', 'amended', 'rejected')`,
        [patientId]
      ),
      pool.query(
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
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const items = dataResult.rows.map((r) => ({
      notificationId: r.notification_id,
      notificationType: r.notification_type,
      deliveryStatus: r.delivery_status,
      sentAt: r.sent_at,
      readAt: r.read_at,
      isUnread: !r.read_at,
      consultation: {
        id: r.consultation_id,
        status: r.consultation_status,
        reviewedAt: r.reviewed_at,
        presentingComplaint: r.presenting_complaint,
        responsePreview: (r.response_preview as string).slice(0, 120) || null,
        doctorName: r.doctor_full_name ? `Dr ${r.doctor_full_name}` : null,
      },
    }));

    const unreadCount = items.filter((i) => i.isUnread).length;

    res.json({
      unreadCount,
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/inbox/:notificationId/read
// Marks a notification as read (sets read_at = NOW()).
// Patient can only mark their own notifications.
// ---------------------------------------------------------------------------
router.patch("/:notificationId/read", async (req, res, next) => {
  try {
    const { rows: patientRows } = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!patientRows[0]) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const patientId = patientRows[0].id;

    const { rows } = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND patient_id = $2 AND read_at IS NULL
       RETURNING id, read_at`,
      [req.params.notificationId, patientId]
    );

    if (!rows[0]) {
      // Already read or not found — both are acceptable; return 200
      res.status(200).json({ alreadyRead: true });
      return;
    }

    res.status(200).json({ id: rows[0].id, readAt: rows[0].read_at });
  } catch (err) {
    next(err);
  }
});

export default router;
