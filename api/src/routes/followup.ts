// PRD-015: Post-Consultation Follow-Up
//
// Scheduling: After doctor approves/amends, followup_send_at is set to reviewed_at + 36h.
// The send endpoint is called by a scheduled task (ECS/EventBridge in production).
// Tracking URLs are unique per consultation; no patient auth required to respond.

import { Router } from "express";
import { createHash } from "crypto";
import { pool } from "../db";
import { sendFollowUpEmail, sendFollowUpConcernAcknowledgementEmail } from "../services/emailService";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import { SendFollowUpSchema } from "../schemas/followup.schema";

const router = Router();

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "https://app.nightingale.com.au";

// F-047: Maximum follow-up sends per consultation (configurable via env, default 3)
const FOLLOWUP_MAX_SENDS = parseInt(process.env.FOLLOWUP_MAX_SENDS ?? "3", 10);

// ---------------------------------------------------------------------------
// POST /api/v1/followup/send  (admin/scheduler — no patient auth)
// Sends follow-up emails for consultations whose followup_send_at has passed.
// F-047/F-048/F-049/F-050: Guard via audit_log count; max FOLLOWUP_MAX_SENDS per consultation.
// ---------------------------------------------------------------------------
router.post("/send", validateBody(SendFollowUpSchema), async (_req, res, next) => {
  try {
    // Lock rows to prevent duplicate sends under concurrent scheduler invocations.
    // F-050: followup_sent_at IS NULL guard removed — audit_log count is the sole guard.
    const { rows: due } = await pool.query(
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

    let sent = 0;
    let blocked = 0;
    const maxSends = parseInt(process.env.FOLLOWUP_MAX_SENDS ?? String(FOLLOWUP_MAX_SENDS), 10);

    for (const row of due) {
      try {
        // F-050: Determine send count from audit_log (no separate column)
        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*) AS cnt FROM audit_log
           WHERE event_type = 'FOLLOWUP_EMAIL_SENT' AND consultation_id = $1`,
          [row.id]
        );
        const sendCount = parseInt(countRows[0].cnt, 10);

        // F-048: Skip if at or above the limit
        if (sendCount >= maxSends) {
          logger.warn(
            { consultationId: row.id, sendCount, maxSends },
            "Follow-up email send limit reached — skipping consultation"
          );
          blocked++;
          continue;
        }

        const trackingBaseUrl = `${WEB_BASE_URL}/followup/${row.followup_token}`;
        await sendFollowUpEmail(
          row.id,
          {
            patientEmail: row.patient_email,
            patientName: row.patient_name,
            presentingComplaint: row.presenting_complaint,
            reviewedAt: row.reviewed_at,
            trackingBaseUrl,
          },
          pool
        );

        await pool.query(
          `UPDATE consultations SET followup_sent_at = NOW() WHERE id = $1`,
          [row.id]
        );
        // Preserve existing audit event for backward compatibility
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('follow_up.sent', $1, 'patient', $2, $3)`,
          [row.id, row.id, JSON.stringify({ token_hash: createHash("sha256").update(row.followup_token).digest("hex") })]
        );
        // F-049: Write FOLLOWUP_EMAIL_SENT event — used as the send-count source of truth
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('FOLLOWUP_EMAIL_SENT', $1, 'patient', $2, $3)`,
          [row.id, row.id, JSON.stringify({ token_hash: createHash("sha256").update(row.followup_token).digest("hex") })]
        );
        sent++;
      } catch (err) {
        logger.error({ err, consultationId: row.id }, "Failed to send follow-up email");
      }
    }

    // F-048: If all due consultations were blocked by the send limit, return 409
    if (due.length > 0 && sent === 0 && blocked === due.length) {
      res.status(409).json({ error: "Maximum follow-up sends reached" });
      return;
    }

    res.json({ sent, due: due.length, blocked });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/followup/respond/:token  (public — no auth; patient clicks link)
// Records the patient's response and redirects to a confirmation page.
// Query param: ?response=better|same|worse
// ---------------------------------------------------------------------------
router.get("/respond/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const { response } = req.query as { response?: string };

    if (!response || !["better", "same", "worse"].includes(response)) {
      res.status(400).json({ error: "Invalid response option. Must be: better, same, or worse" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, status, patient_id, assigned_doctor_id,
              followup_response, presenting_complaint
       FROM consultations
       WHERE followup_token = $1`,
      [token]
    );

    const consultation = rows[0];
    if (!consultation) {
      res.status(404).json({ error: "Follow-up link not found or expired" });
      return;
    }

    // Idempotent: if already responded, redirect to confirmation
    if (consultation.followup_response) {
      res.redirect(302, `${WEB_BASE_URL}/followup/confirmed?response=${consultation.followup_response}`);
      return;
    }

    const newStatus =
      response === "better" ? "resolved" :
      response === "same"   ? "unchanged" :
                              "followup_concern";

    await pool.query(
      `UPDATE consultations
       SET followup_response = $1,
           followup_responded_at = NOW(),
           status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [response, newStatus, consultation.id]
    );

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('follow_up.response_received', $1, 'patient', $2, $3)`,
      [consultation.patient_id, consultation.id,
       JSON.stringify({ response_option: response, new_status: newStatus })]
    );

    if (response === "worse") {
      // Add FOLLOWUP_CONCERN priority flag and re-queue for doctor
      await pool.query(
        `UPDATE consultations
         SET priority_flags = array_append(
               COALESCE(priority_flags, '{}'),
               'FOLLOWUP_CONCERN'
             )
         WHERE id = $1`,
        [consultation.id]
      );

      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
         VALUES ('consultation.reopened_for_followup', $1, 'patient', $2, $3)`,
        [consultation.patient_id, consultation.id,
         JSON.stringify({ doctor_id: consultation.assigned_doctor_id })]
      );

      // Send acknowledgement to patient (fire-and-forget)
      sendFollowUpConcernAcknowledgementEmail(consultation.patient_id, pool).catch((err) =>
        logger.error({ err, consultationId: consultation.id }, "Failed to send followup concern acknowledgement")
      );

      // Notify doctor (reuse existing emailService infrastructure — future PRD-016 alert)
      logger.info(
        { consultationId: consultation.id, doctorId: consultation.assigned_doctor_id },
        "Follow-up concern flagged — consultation re-opened for doctor review"
      );
    }

    res.redirect(302, `${WEB_BASE_URL}/followup/confirmed?response=${response}`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/followup/schedule/:consultationId  (internal — called after approve/amend)
// Sets followup_send_at = reviewed_at + 36 hours for an eligible consultation.
// ---------------------------------------------------------------------------
export async function scheduleFollowUp(consultationId: string): Promise<void> {
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

export default router;
