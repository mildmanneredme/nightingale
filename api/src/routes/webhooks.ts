// PRD-014: SendGrid delivery webhook
//
// Receives delivery status events from SendGrid and updates the notifications table.
// SEC-002: ECDSA signature verified via @sendgrid/eventwebhook before any DB writes.
//
// Event types handled: delivered, bounce, dropped, spamreport
// Full event reference: https://docs.sendgrid.com/for-developers/tracking-events/event

import { Router, Request, Response, NextFunction } from "express";
import { EventWebhook } from "@sendgrid/eventwebhook";
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
// Body arrives as Buffer (express.raw applied in app.ts before express.json).
router.post("/sendgrid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SEC-002: Verify ECDSA signature before any processing
    const pubKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
    if (!pubKey) {
      logger.warn("SENDGRID_WEBHOOK_PUBLIC_KEY not set — rejecting webhook (fail-closed)");
      res.status(500).json({ error: "Webhook verification not configured" });
      return;
    }

    const sig = req.headers["x-twilio-email-event-webhook-signature"] as string | undefined;
    const ts = req.headers["x-twilio-email-event-webhook-timestamp"] as string | undefined;

    if (!sig || !ts) {
      res.status(403).json({ error: "Missing webhook signature headers" });
      return;
    }

    // Raw body may be a Buffer (production via express.raw) or already-parsed (test env fallback)
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const ev = new EventWebhook();
    const key = ev.convertPublicKeyToECDSA(pubKey);
    const isValid = ev.verifySignature(key, rawBody, sig, ts);

    if (!isValid) {
      res.status(403).json({ error: "Invalid webhook signature" });
      return;
    }

    // Parse body — raw Buffer in production, already parsed in test env
    let events: SendGridEvent[];
    if (Buffer.isBuffer(req.body)) {
      const parsed = JSON.parse(req.body.toString("utf8"));
      events = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      events = Array.isArray(req.body) ? req.body : [req.body];
    }

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
