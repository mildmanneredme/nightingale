// PRD-014: SendGrid delivery webhook
//
// Receives delivery status events from SendGrid and updates the notifications table.
// No authentication required for this endpoint — SendGrid calls it from their servers.
//
// Event types handled: delivered, bounce, dropped, spamreport
// Full event reference: https://docs.sendgrid.com/for-developers/tracking-events/event

import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { logger } from "../logger";

const router = Router();

interface SendGridEvent {
  event: "delivered" | "bounce" | "dropped" | "spamreport" | string;
  sg_message_id?: string;   // "base_message_id.filter..."
  email?: string;
  timestamp?: number;
  reason?: string;
  status?: string;
  type?: string;            // present on bounce events
}

// POST /api/v1/webhooks/sendgrid
router.post("/sendgrid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events: SendGridEvent[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const evt of events) {
      if (!evt.sg_message_id) continue;

      // SendGrid appends ".filter..." to the message ID in webhooks — strip it
      const baseMessageId = evt.sg_message_id.split(".")[0];

      // Look up the notification record by SendGrid message ID
      const { rows } = await pool.query<{ id: string; consultation_id: string; patient_id: string }>(
        `SELECT id, consultation_id, patient_id
         FROM notifications
         WHERE sendgrid_message_id = $1`,
        [baseMessageId]
      );

      const notification = rows[0];
      if (!notification) {
        logger.warn({ sg_message_id: baseMessageId, event: evt.event }, "Unknown SendGrid message ID");
        continue;
      }

      if (evt.event === "delivered") {
        await pool.query(
          `UPDATE notifications SET status = 'delivered', delivered_at = NOW() WHERE id = $1`,
          [notification.id]
        );
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('notification.delivered', $1, 'patient', $2, $3)`,
          [notification.patient_id, notification.consultation_id,
           JSON.stringify({ notification_id: notification.id })]
        );

      } else if (evt.event === "bounce" || evt.event === "dropped") {
        await pool.query(
          `UPDATE notifications SET status = 'bounced' WHERE id = $1`,
          [notification.id]
        );
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('notification.delivery_failed', $1, 'patient', $2, $3)`,
          [notification.patient_id, notification.consultation_id,
           JSON.stringify({ notification_id: notification.id, event: evt.event, reason: evt.reason ?? null })]
        );
        logger.error(
          { notification_id: notification.id, event: evt.event, reason: evt.reason },
          "Email delivery failed"
        );

      } else if (evt.event === "spamreport") {
        await pool.query(
          `UPDATE notifications SET status = 'failed' WHERE id = $1`,
          [notification.id]
        );
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('notification.delivery_failed', $1, 'patient', $2, $3)`,
          [notification.patient_id, notification.consultation_id,
           JSON.stringify({ notification_id: notification.id, event: "spamreport" })]
        );
      }
    }

    // Always respond 200 — SendGrid retries on non-2xx responses
    res.status(200).json({ received: events.length });
  } catch (err) {
    next(err);
  }
});

export default router;
