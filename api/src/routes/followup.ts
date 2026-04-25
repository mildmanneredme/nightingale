// PRD-015: Post-Consultation Follow-Up
//
// Scheduling: After doctor approves/amends, followup_send_at is set to reviewed_at + 36h.
// The send endpoint is called by a scheduled task (ECS/EventBridge in production).
// Tracking URLs are unique per consultation; no patient auth required to respond.

import { Router } from "express";
import { sendFollowUpEmail, sendFollowUpConcernAcknowledgementEmail } from "../services/emailService";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import { SendFollowUpSchema } from "../schemas/followup.schema";
import {
  findFollowUpsDue,
  countFollowUpEmailsSent,
  markFollowUpSent,
  insertFollowUpSentAuditLog,
  insertFollowUpEmailSentAuditLog,
  findConsultationByFollowUpToken,
  updateFollowUpResponse,
  insertFollowUpResponseAuditLog,
  appendFollowUpConcernFlag,
  insertConsultationReopenedAuditLog,
  scheduleFollowUpQuery,
  hashToken,
} from "../repositories/followup.repository";
import { pool } from "../db";

const router = Router();

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "https://app.nightingale.com.au";

// ---------------------------------------------------------------------------
// POST /api/v1/followup/send  (admin/scheduler — no patient auth)
// Sends follow-up emails for consultations whose followup_send_at has passed.
// F-047/F-048/F-049/F-050: Guard via audit_log count; max FOLLOWUP_MAX_SENDS per consultation.
// ---------------------------------------------------------------------------
router.post("/send", validateBody(SendFollowUpSchema), async (_req, res, next) => {
  try {
    // F-047: Derive maxSends per-request so env overrides are always authoritative.
    const maxSends = parseInt(process.env.FOLLOWUP_MAX_SENDS ?? "3", 10);
    if (isNaN(maxSends) || maxSends < 1) {
      logger.error({ raw: process.env.FOLLOWUP_MAX_SENDS }, "Invalid FOLLOWUP_MAX_SENDS — must be a positive integer");
      return next(new Error("Invalid FOLLOWUP_MAX_SENDS configuration"));
    }

    // Lock rows to prevent duplicate sends under concurrent scheduler invocations.
    // F-050: followup_sent_at IS NULL guard removed — audit_log count is the sole guard.
    const due = await findFollowUpsDue();

    let sent = 0;
    let blocked = 0;

    for (const row of due) {
      try {
        // F-050: Determine send count from audit_log (no separate column)
        const sendCount = await countFollowUpEmailsSent(row.id);

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

        const token_hash = hashToken(row.followup_token);
        await markFollowUpSent(row.id);
        // Preserve existing audit event for backward compatibility
        await insertFollowUpSentAuditLog(row.id, token_hash);
        // F-049: Write FOLLOWUP_EMAIL_SENT event — used as the send-count source of truth
        await insertFollowUpEmailSentAuditLog(row.id, token_hash);
        sent++;
      } catch (err) {
        logger.error({ err, consultationId: row.id }, "Failed to send follow-up email");
      }
    }

    // F-048: 409 whenever any consultation was blocked by the send limit
    if (blocked > 0) {
      res.status(409).json({ error: "Maximum follow-up sends reached", sent, blocked });
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

    const consultation = await findConsultationByFollowUpToken(token);

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

    await updateFollowUpResponse(consultation.id, response, newStatus);

    await insertFollowUpResponseAuditLog(consultation.patient_id, consultation.id, response, newStatus);

    if (response === "worse") {
      // Add FOLLOWUP_CONCERN priority flag and re-queue for doctor
      await appendFollowUpConcernFlag(consultation.id);

      await insertConsultationReopenedAuditLog(
        consultation.patient_id,
        consultation.id,
        consultation.assigned_doctor_id
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
  await scheduleFollowUpQuery(consultationId);
}

export default router;
