// PRD-015: Post-Consultation Follow-Up
//
// Scheduling: After doctor approves/amends, followup_send_at is set to reviewed_at + 36h.
// The send endpoint is called by a scheduled task (ECS/EventBridge in production).
// Tracking URLs are unique per consultation; no patient auth required to respond.

import { Router } from "express";
import { pool } from "../db";
import { sendFollowUpEmail, sendFollowUpConcernAcknowledgementEmail } from "../services/emailService";
import { logger } from "../logger";

const router = Router();

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "https://app.nightingale.com.au";

// ---------------------------------------------------------------------------
// POST /api/v1/followup/send  (admin/scheduler — no patient auth)
// Sends follow-up emails for consultations whose followup_send_at has passed.
// Idempotent: sets followup_sent_at so duplicates cannot be sent.
// ---------------------------------------------------------------------------
router.post("/send", async (_req, res, next) => {
  try {
    // Lock rows to prevent duplicate sends under concurrent scheduler invocations
    const { rows: due } = await pool.query(
      `SELECT c.id, c.followup_token, c.presenting_complaint,
              c.reviewed_at, c.status,
              p.email AS patient_email, p.full_name AS patient_name
       FROM consultations c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.followup_send_at IS NOT NULL
         AND c.followup_send_at <= NOW()
         AND c.followup_sent_at IS NULL
         AND c.status IN ('approved', 'amended')
       FOR UPDATE SKIP LOCKED
       LIMIT 50`
    );

    let sent = 0;
    for (const row of due) {
      try {
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
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('follow_up.sent', $1, 'patient', $2, $3)`,
          [row.id, row.id, JSON.stringify({ token: row.followup_token })]
        );
        sent++;
      } catch (err) {
        logger.error({ err, consultationId: row.id }, "Failed to send follow-up email");
      }
    }

    res.json({ sent, due: due.length });
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
